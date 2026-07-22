import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/services/dbService';
import { llmService } from '@/services/llmService';
import { authenticate, unauthorizedResponse } from '@/utils/auth';
import { extractReportType } from '@/utils/reportType';

// Timeout de la función serverless (en segundos) — necesario para Vercel Hobby plan
export const maxDuration = 60;

function normalizeDictatedPunctuation(text: string): string {
  let normalized = text;
  normalized = normalized.replace(/\bcoma\b/gi, ',');
  normalized = normalized.replace(/\bpunto\b/gi, '.');
  normalized = normalized.replace(/\bdos puntos\b/gi, ':');
  normalized = normalized.replace(/\bpunto y coma\b/gi, ';');
  normalized = normalized.replace(/\babre par[eÃ©]ntesis\b/gi, '(');
  normalized = normalized.replace(/\bcierra par[eÃ©]ntesis\b/gi, ')');
  normalized = normalized.replace(/\bentre par[eÃ©]ntesis\b/gi, '( )');
  normalized = normalized.replace(/\bbarra\b/gi, '/');
  normalized = normalized.replace(/\bguion\b/gi, '-');
  return normalized;
}

export async function POST(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return unauthorizedResponse();

  let currentAiModel = 'gemini';

  try {
    const { reportId, originalReport, correctionInstruction, doctorId } = await req.json();

    if (!originalReport || !correctionInstruction) {
      return NextResponse.json({ error: 'Faltan campos requeridos: originalReport o correctionInstruction.' }, { status: 400 });
    }

    let docIdNum = doctorId ? parseInt(doctorId, 10) : null;
    if (user.role === 'doctor') {
      docIdNum = user.doctorId;
    } else if (!docIdNum && reportId) {
      const repRes = await db.query('SELECT doctor_id FROM reports WHERE id = $1', [parseInt(reportId, 10)]);
      if (repRes.rows.length > 0 && repRes.rows[0].doctor_id) {
        docIdNum = repRes.rows[0].doctor_id;
      }
    }

    let doctorProfile: any = null;
    if (docIdNum) {
      const docRes = await db.query('SELECT * FROM doctors WHERE id = $1', [docIdNum]);
      if (docRes.rows.length > 0) {
        doctorProfile = docRes.rows[0];
      }
    }

    const normalizedInstruction = normalizeDictatedPunctuation(correctionInstruction);

    const settingsRes = await db.query("SELECT value FROM system_settings WHERE key = 'active_ai_model'");
    const activeAiModelVal = settingsRes.rows.length > 0 ? settingsRes.rows[0].value : 'gemini';
    currentAiModel = activeAiModelVal === 'gemma' ? 'gemini' : activeAiModelVal;

    const updatedReport = await llmService.correctReport(originalReport, normalizedInstruction, doctorProfile, currentAiModel);
    const updatedReportType = extractReportType(updatedReport);

    if (reportId) {
      await db.query(
        'UPDATE reports SET structured_text = $1, report_type = $2 WHERE id = $3',
        [updatedReport, updatedReportType, parseInt(reportId, 10)]
      );
    }

    return NextResponse.json({
      id: reportId ? parseInt(reportId, 10) : null,
      updatedReport,
      structuredText: updatedReport,
      reportType: updatedReportType,
      doctorId: docIdNum,
      doctorName: doctorProfile?.name || null,
      doctorSpecialty: doctorProfile?.specialty || null
    });
  } catch (error: any) {
    console.error('Error en /api/reports/correct:', error);
    const providerFormatted = (currentAiModel.includes('chatgpt') || currentAiModel.includes('openai')) ? 'ChatGPT' : 'Gemini';
    return NextResponse.json({
      error: error.message || 'Error aplicando la corrección con la IA.',
      isAiError: true,
      aiProvider: providerFormatted
    }, { status: 500 });
  }
}

