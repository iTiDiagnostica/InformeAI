import dotenv from 'dotenv';

dotenv.config();

// Groq Whisper API (gratis, rápido)
// Configurar GROQ_API_KEY en .env con tu key de https://console.groq.com
const WHISPER_API_URL = process.env.WHISPER_API_URL || 'https://api.groq.com/openai/v1';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

export const whisperService = {
  /**
   * Transcribe un archivo de audio usando Groq Whisper (o cualquier endpoint compatible con OpenAI).
   * Soporta: mp3, wav, ogg, webm, m4a, flac, aac, wma, mp4, mpeg
   */
  transcribe: async (fileBuffer: Buffer, originalName: string, mimeType: string): Promise<string> => {
    if (!GROQ_API_KEY) {
      throw new Error(
        'GROQ_API_KEY no configurada. Obtenga una key gratuita en https://console.groq.com y agréguela al archivo .env'
      );
    }

    const url = `${WHISPER_API_URL}/audio/transcriptions`;

    // Construir FormData con el archivo de audio
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
    formData.append('file', blob, originalName);
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('language', 'es');
    formData.append('response_format', 'json');

    try {
      console.log(`🎙️ Enviando audio a Groq Whisper (${originalName}, ${(fileBuffer.length / 1024).toFixed(1)} KB)...`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        // Errores comunes de Groq
        if (response.status === 401) {
          throw new Error('GROQ_API_KEY inválida o expirada. Verifique su key en https://console.groq.com');
        }
        if (response.status === 413) {
          throw new Error('El archivo de audio es demasiado grande para Groq (máx 25 MB).');
        }
        if (response.status === 429) {
          throw new Error('Límite de uso de Groq alcanzado. Espere un momento e intente nuevamente.');
        }
        throw new Error(`Groq Whisper respondió con código ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const transcription = data.text;

      if (!transcription || transcription.trim().length === 0) {
        throw new Error('La transcripción está vacía. Verifique que el audio contenga habla clara en español.');
      }

      console.log(`✅ Audio transcripto exitosamente (${transcription.length} caracteres).`);
      return transcription;
    } catch (error: any) {
      // Detectar errores de conexión de red
      const isNetworkError =
        error.cause?.code === 'ECONNREFUSED' ||
        error.cause?.code === 'ECONNRESET' ||
        error.cause?.code === 'ETIMEDOUT' ||
        error.message?.includes('fetch failed') ||
        (error.name === 'TypeError' && !error.message?.includes('GROQ'));

      if (isNetworkError) {
        console.error('❌ No se pudo conectar a Groq:', error.message);
        throw new Error(
          'No se pudo conectar al servicio de transcripción Groq. Verifique su conexión a internet.'
        );
      }

      // Re-lanzar errores ya formateados
      if (error.message?.includes('GROQ') || error.message?.includes('Groq') || error.message?.includes('transcripción')) {
        throw error;
      }

      console.error('❌ Error en transcripción de audio:', error.message);
      throw new Error(`Error al transcribir: ${error.message}`);
    }
  }
};
