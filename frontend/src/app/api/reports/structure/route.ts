import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/services/dbService';
import { llmService } from '@/services/llmService';
import { ragService } from '@/services/ragService';
import { authenticate, unauthorizedResponse } from '@/utils/auth';

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

export async function POST(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return unauthorizedResponse();

  try {
    const { rawText, doctorId } = await req.json();

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json({ error: 'El texto del dictado estÃ¡ vacÃ­o.' }, { status: 400 });
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
        const activeAiModel = activeAiModelVal === 'gemma' ? 'gemini' : activeAiModelVal;
        
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
            activeAiModel
          );
        } else {
          emptyTemplate = await llmService.generateMergedEmptyTemplate(
            templateDocs.map(d => ({ title: d.title, content: d.content })),
            doctorProfile,
            activeAiModel
          );
        }

        const repRes = await db.query(
          'INSERT INTO reports (raw_text, structured_text, doctor_id, company_id) VALUES ($1, $2, $3, $4) RETURNING id',
          [rawText, emptyTemplate, finalDoctorId, companyIdVal]
        );

        return NextResponse.json({
          id: repRes.rows[0].id,
          reportId: repRes.rows[0].id,
          structuredText: emptyTemplate,
          structuredReport: emptyTemplate,
          contextUsed: `Plantilla(s) en blanco cargada(s): ${templateDocs.map(d => d.title).join(', ')}`,
          isTemplateLoad: true,
          doctorId: finalDoctorId,
          doctorName: doctorProfile?.name || null,
          doctorSpecialty: doctorProfile?.specialty || null
        });
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
    const activeAiModel = activeAiModelVal === 'gemma' ? 'gemini' : activeAiModelVal;

    const structuredReport = await llmService.structureReport(rawText, context, doctorProfile, activeAiModel);

    const insertRes = await db.query(
      'INSERT INTO reports (raw_text, structured_text, doctor_id, company_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [rawText, structuredReport, finalDoctorId, companyIdVal]
    );

    return NextResponse.json({
      id: insertRes.rows[0].id,
      reportId: insertRes.rows[0].id,
      structuredText: structuredReport,
      structuredReport,
      contextUsed: matchFound ? context : 'No se utilizó contexto.',
      doctorId: finalDoctorId,
      doctorName: doctorProfile?.name || null,
      doctorSpecialty: doctorProfile?.specialty || null
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message || 'Error estructurando el informe.' }, { status: 500 });
  }
}

