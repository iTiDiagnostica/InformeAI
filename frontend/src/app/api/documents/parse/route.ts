import { NextRequest, NextResponse } from 'next/server';
import { authenticate, unauthorizedResponse } from '@/utils/auth';
const pdfParse = require('pdf-parse');
import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';
import { parseRTF } from '@jonahschulte/rtf-toolkit';

export async function POST(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return unauthorizedResponse();

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se recibiÃ³ ningÃºn archivo.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename = file.name;
    const mimetype = file.type;

    let parsedText = '';

    if (mimetype === 'application/pdf') {
      const data = await pdfParse(buffer);
      parsedText = data.text;
    } 
    else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || filename.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      parsedText = result.value;
    }
    else if (mimetype === 'application/msword' || filename.endsWith('.doc')) {
      const extractor = new WordExtractor();
      const extracted = await extractor.extract(buffer);
      parsedText = extracted.getBody();
    }
    else if (mimetype === 'text/rtf' || filename.endsWith('.rtf')) {
      parsedText = parseRTF(buffer.toString('utf-8'));
    }
    else if (mimetype === 'text/plain' || filename.endsWith('.txt')) {
      parsedText = buffer.toString('utf-8');
    }
    else {
      return NextResponse.json({ error: 'Formato de archivo no soportado. Use PDF, DOCX, DOC, RTF o TXT.' }, { status: 400 });
    }

    if (!parsedText || parsedText.trim().length === 0) {
      return NextResponse.json({ error: 'El archivo estÃ¡ vacÃ­o o no se pudo extraer texto.' }, { status: 400 });
    }

    // Limpiar nombre quitando extensiÃ³n
    let title = filename.replace(/\.[^/.]+$/, "");
    title = title.replace(/_/g, " ").replace(/-/g, " ");

    return NextResponse.json({
      title,
      content: parsedText.trim()
    });
  } catch (error: any) {
    console.error('Error parseando documento:', error);
    return NextResponse.json({ error: error.message || 'Error al procesar el archivo.' }, { status: 500 });
  }
}

