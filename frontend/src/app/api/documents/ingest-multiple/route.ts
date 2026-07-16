import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/services/dbService';
import { ragService } from '@/services/ragService';
import { authenticate, unauthorizedResponse, forbiddenResponse } from '@/utils/auth';
import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';
import { parseRTF, toHTML } from '@jonahschulte/rtf-toolkit';

function cleanHTML(html: string): string {
  let text = html;
  
  // Reemplazar etiquetas de negrita por **
  text = text.replace(/<(strong|b)\b[^>]*>/gi, '**');
  text = text.replace(/<\/(strong|b)>/gi, '**');
  
  // Reemplazar saltos de bloque por saltos de línea
  text = text.replace(/<p\b[^>]*>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<br\b[^>]*>/gi, '\n');
  text = text.replace(/<div\b[^>]*>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<tr\b[^>]*>/gi, '\n');
  text = text.replace(/<td\b[^>]*>/gi, ' ');
  
  // Eliminar el resto de etiquetas HTML
  text = text.replace(/<[^>]+>/g, '');
  
  // Decodificar entidades HTML comunes
  text = text.replace(/&nbsp;/g, ' ')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&amp;/g, '&')
             .replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'");
             
  // Normalizar saltos de línea
  const lines = text.split('\n');
  const cleanedLines = lines.map(line => line.trim());
  
  let result = '';
  let prevLineWasEmpty = false;
  for (const line of cleanedLines) {
    if (line === '') {
      if (!prevLineWasEmpty) {
        result += '\n';
        prevLineWasEmpty = true;
      }
    } else {
      if (result !== '') {
        result += '\n';
      }
      result += line;
      prevLineWasEmpty = false;
    }
  }
  
  return result.trim();
}

export async function POST(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return unauthorizedResponse();

  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const doctorId = formData.get('doctorId') as string | null;

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No se recibieron archivos.' }, { status: 400 });
    }

    let targetDoctorId: number | null = null;
    let targetCompanyId: number | null = null;

    if (user.role === 'doctor') {
      targetDoctorId = user.doctorId;
      const docRes = await db.query('SELECT company_id FROM doctors WHERE id = $1', [user.doctorId]);
      targetCompanyId = docRes.rows.length > 0 ? docRes.rows[0].company_id : null;
    } else if (user.role === 'moderator') {
      targetCompanyId = user.companyId;
      if (doctorId) {
        const docRes = await db.query('SELECT company_id FROM doctors WHERE id = $1', [doctorId]);
        if (docRes.rows.length === 0 || docRes.rows[0].company_id !== user.companyId) {
          return forbiddenResponse('No puede asignar plantillas a un médico que no pertenece a su empresa.');
        }
        targetDoctorId = parseInt(doctorId, 10);
      }
    } else if (user.role === 'admin') {
      if (doctorId) {
        targetDoctorId = parseInt(doctorId, 10);
        const docRes = await db.query('SELECT company_id FROM doctors WHERE id = $1', [doctorId]);
        targetCompanyId = docRes.rows.length > 0 ? docRes.rows[0].company_id : null;
      }
    }

    const results = [];

    for (const file of files) {
      const fileName = file.name;
      const lowerName = fileName.toLowerCase();
      let content = '';

      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (lowerName.endsWith('.docx')) {
          try {
            const parseResult = await mammoth.extractRawText({ buffer });
            content = parseResult.value.trim();
          } catch (mammothErr) {
            const extractor = new WordExtractor();
            const doc = await extractor.extract(buffer);
            content = doc.getBody().trim();
          }
        } else if (lowerName.endsWith('.pdf')) {
          const pdfParse = require('pdf-parse');
          const pdfData = await pdfParse(buffer);
          content = pdfData.text.trim();
        } else if (lowerName.endsWith('.txt')) {
          content = buffer.toString('utf-8').trim();
        } else if (lowerName.endsWith('.doc')) {
          try {
            const extractor = new WordExtractor();
            const doc = await extractor.extract(buffer);
            content = doc.getBody().trim();
          } catch (extractorErr) {
            const parseResult = await mammoth.extractRawText({ buffer });
            content = parseResult.value.trim();
          }
        } else if (lowerName.endsWith('.rtf')) {
          const parsed = parseRTF(buffer.toString('utf-8'));
          const html = toHTML(parsed);
          content = cleanHTML(html);
        } else {
          throw new Error('Formato de archivo no soportado. Use Word, PDF, RTF o TXT.');
        }

        if (content.length < 10) {
          throw new Error('El contenido extraído es demasiado corto o está vacío.');
        }

        const title = fileName.replace(/\.[^/.]+$/, "").replace(/_/g, " ").replace(/-/g, " ");
        const documentId = await ragService.ingestDocument(title, content, targetDoctorId, targetCompanyId);

        results.push({
          fileName,
          status: 'success' as const,
          documentId
        });
      } catch (err: any) {
        results.push({
          fileName,
          status: 'error' as const,
          error: err.message || 'Error desconocido'
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    return NextResponse.json({
      message: `Procesamiento en lote completado. Éxitos: ${successCount}, Errores: ${errorCount}`,
      results
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
