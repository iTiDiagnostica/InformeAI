import { NextRequest, NextResponse } from 'next/server';
import { whisperService } from '@/services/whisperService';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'No se recibiÃ³ ningÃºn archivo de audio.' }, { status: 400 });
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const transcription = await whisperService.transcribe(buffer, audioFile.name, audioFile.type);
    
    return NextResponse.json({ transcription });
  } catch (error: any) {
    console.error('Error in /api/audio/transcribe:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor durante la transcripciÃ³n.' }, { status: 500 });
  }
}

