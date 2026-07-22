import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/services/dbService';
import { llmService } from '@/services/llmService';
import { ragService } from '@/services/ragService';
import { authenticate, unauthorizedResponse } from '@/utils/auth';
import { extractReportType } from '@/utils/reportType';

// Timeout de la función serverless (en segundos) — necesario para Vercel Hobby plan (máx 60s)
// Se exporta directamente en el route.ts porque vercel.json no aplica confiablemente con App Router
export const maxDuration = 60;

function splitTemplateQuery(query: string): string[] {
  return query
    .split(/(?:\s+y\s+|\s+con\s+|,)/i)
    .map(part => part.trim())
    .filter(part => part.length > 0);
}

function detectTemplateRequest(text: string): { isTemplate: boolean; query: string } {
  const normalized = text.toLowerCase().trim();
  const markers = [
    "quiero la plantilla de",
    "necesito la plantilla de",
    "plantilla de",
    "abrir plantilla de",
    "dame la plantilla de",
    "plantilla para",
    "formato de",
    "quiero el formato de"
  ];
  for (const marker of markers) {
    if (normalized.startsWith(marker)) {
      let query = normalized.substring(marker.length).trim();
      query = query.replace(/\.$/, "").trim();
      return { isTemplate: true, query };
    }
  }
  return { isTemplate: false, query: '' };
}

async function findTemplateDocument(query: string, doctorId: number | null, companyId: number | null) {
  let docRes;
  if (doctorId) {
    docRes = await db.query(
      'SELECT id, title, content, doctor_id, company_id FROM documents WHERE doctor_id = $1 AND title ILIKE $2 LIMIT 1',
      [doctorId, `%${query}%`]
    );
  }
  if ((!docRes || docRes.rows.length === 0) && companyId) {
    docRes = await db.query(
      'SELECT id, title, content, doctor_id, company_id FROM documents WHERE company_id = $1 AND title ILIKE $2 LIMIT 1',
      [companyId, `%${query}%`]
    );
  }
  if (!docRes || docRes.rows.length === 0) {
    docRes = await db.query(
      'SELECT id, title, content, doctor_id, company_id FROM documents WHERE doctor_id IS NULL AND company_id IS NULL AND title ILIKE $1 LIMIT 1',
      [`%${query}%`]
    );
  }
  return docRes?.rows[0];
}

function formatAiType(activeAiModel: string): string {
  if (!activeAiModel) return 'Gemini';
  const lower = activeAiModel.toLowerCase();
  if (lower.includes('gemini')) return 'Gemini';
  if (lower.includes('chatgpt') || lower.includes('openai') || lower.includes('gpt')) return 'ChatGPT';
  if (lower.includes('groq')) return 'Groq';
  return activeAiModel.charAt(0).toUpperCase() + activeAiModel.slice(1);
}

export async function POST(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return unauthorizedResponse();

  let currentAiModel = 'gemini';

  try {
    const { rawText, doctorId } = await req.json();

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json({ error: 'El texto del dictado está vacío.' }, { status: 400 });
    }

    let docIdNum = doctorId ? parseInt(doctorId, 10) : null;
    let companyIdVal: number | null = null;

    if (user.role === 'doctor') {
      docIdNum = user.doctorId;
      const docRes = await db.query('SELECT company_id FROM doctors WHERE id = $1', [user.doctorId]);
      companyIdVal = docRes.rows[0]?.company_id || null;
    }

    const templateCheck = detectTemplateRequest(rawText);
    if (templateCheck.isTemplate) {
      const queryParts = splitTemplateQuery(templateCheck.query);
      const templateDocs: any[] = [];
      for (const part of queryParts) {
        const doc = await findTemplateDocument(part, docIdNum, companyIdVal);
        if (doc) templateDocs.push(doc);
      }

      if (templateDocs.length > 0) {
        const settingsRes = await db.query("SELECT value FROM system_settings WHERE key = 'active_ai_model'");
        const activeAiModelVal = settingsRes.rows.length > 0 ? settingsRes.rows[0].value : 'gemini';
        currentAiModel = activeAiModelVal === 'gemma' ? 'gemini' : activeAiModelVal;
        
        const finalDoctorId = docIdNum || templateDocs[0].doctor_id;
        let doctorProfile: any = null;
        if (finalDoctorId) {
          const docRes = await db.query('SELECT * FROM doctors WHERE id = $1', [finalDoctorId]);
          if (docRes.rows.length > 0) doctorProfile = docRes.rows[0];
        }

        let emptyTemplate = '';
        if (templateDocs.length === 1) {
          emptyTemplate = await llmService.generateEmptyTemplate(
            templateDocs[0].title,
            templateDocs[0].content,
            doctorProfile,
            currentAiModel
          );
        } else {
          emptyTemplate = await llmService.generateMergedEmptyTemplate(
            templateDocs.map(d => ({ title: d.title, content: d.content })),
            doctorProfile,
            currentAiModel
          );
        }

        const aiTypeFormatted = formatAiType(currentAiModel);
        const createdByRoleVal = user.role === 'admin' ? 'Administrador' : user.role === 'doctor' ? 'Médico' : 'Invitado';
        const detectedReportType = extractReportType(emptyTemplate, rawText);

        const repRes = await db.query(
          'INSERT INTO reports (raw_text, structured_text, doctor_id, company_id, ai_type, created_by_role, report_type) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
          [rawText, emptyTemplate, finalDoctorId, companyIdVal, aiTypeFormatted, createdByRoleVal, detectedReportType]
        );

        return NextResponse.json({
          id: repRes.rows[0].id,
          reportId: repRes.rows[0].id,
          structuredText: emptyTemplate,
          structuredReport: emptyTemplate,
          reportType: detectedReportType,
          contextUsed: `Plantilla(s) en blanco cargada(s): ${templateDocs.map(d => d.title).join(', ')}`,
          isTemplateLoad: true,
          doctorId: finalDoctorId,
          doctorName: doctorProfile?.name || null,
          doctorSpecialty: doctorProfile?.specialty || null
        });
      } else {
        return NextResponse.json({
          error: `No se encontró la plantilla para: "${templateCheck.query}"`,
          code: 'TEMPLATE_NOT_FOUND',
          query: templateCheck.query
        }, { status: 404 });
      }
    }

    let searchDoctorId = docIdNum;
    const searchRes = await ragService.searchContext(rawText, 3, searchDoctorId, companyIdVal);
    let { context, detectedDoctorId, matchFound } = searchRes;
    
    let finalDoctorId = searchDoctorId || detectedDoctorId;
    let doctorProfile: any = null;
    
    if (finalDoctorId) {
      const docRes = await db.query('SELECT * FROM doctors WHERE id = $1', [finalDoctorId]);
      if (docRes.rows.length > 0) {
        doctorProfile = docRes.rows[0];
      }
    }

    const settingsRes = await db.query("SELECT value FROM system_settings WHERE key = 'active_ai_model'");
    const activeAiModelVal = settingsRes.rows.length > 0 ? settingsRes.rows[0].value : 'gemini';
    currentAiModel = activeAiModelVal === 'gemma' ? 'gemini' : activeAiModelVal;

    const structuredReport = await llmService.structureReport(rawText, context, doctorProfile, currentAiModel);

    const aiTypeFormatted = formatAiType(currentAiModel);
    const createdByRoleVal = user.role === 'admin' ? 'Administrador' : user.role === 'doctor' ? 'Médico' : 'Invitado';
    const detectedReportType = extractReportType(structuredReport, rawText);

    const insertRes = await db.query(
      'INSERT INTO reports (raw_text, structured_text, doctor_id, company_id, ai_type, created_by_role, report_type) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [rawText, structuredReport, finalDoctorId, companyIdVal, aiTypeFormatted, createdByRoleVal, detectedReportType]
    );

    return NextResponse.json({
      id: insertRes.rows[0].id,
      reportId: insertRes.rows[0].id,
      structuredText: structuredReport,
      structuredReport,
      reportType: detectedReportType,
      contextUsed: matchFound ? context : 'No se utilizó contexto.',
      doctorId: finalDoctorId,
      doctorName: doctorProfile?.name || null,
      doctorSpecialty: doctorProfile?.specialty || null
    });
  } catch (error: any) {
    console.error('Error en /api/reports/structure:', error);
    const providerFormatted = formatAiType(currentAiModel);
    return NextResponse.json({
      error: error.message || 'Error procesando el informe con la IA.',
      isAiError: true,
      aiProvider: providerFormatted
    }, { status: 500 });
  }
}

