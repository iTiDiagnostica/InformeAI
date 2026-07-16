import { GoogleGenAI } from '@google/genai';

let currentKeyIndex = 0;

function getGeminiApiKeys(): string[] {
  const keysEnv = process.env.GEMINI_API_KEYS;
  if (keysEnv) {
    const keys = keysEnv.split(',').map(k => k.trim()).filter(k => k.length > 0);
    if (keys.length > 0) {
      return keys;
    }
  }
  const singleKey = process.env.GEMINI_API_KEY;
  if (!singleKey || singleKey.trim() === '') {
    throw new Error('GEMINI_API_KEY no está configurada en las variables de entorno.');
  }
  return [singleKey];
}

async function callEmbedContentWithFallback(params: { model: string; contents: string | string[]; config: { outputDimensionality: number } }) {
  const keys = getGeminiApiKeys();
  const totalKeys = keys.length;
  let lastError: any = null;

  for (let attempt = 0; attempt < totalKeys; attempt++) {
    const index = (currentKeyIndex + attempt) % totalKeys;
    const apiKey = keys[index];
    const ai = new GoogleGenAI({ apiKey });

    try {
      const response = await ai.models.embedContent(params);
      currentKeyIndex = index; // Guardar la clave que funcionó
      return response;
    } catch (err: any) {
      console.warn(`⚠️ Generación de embedding falló con clave índice ${index}:`, err.message || err);
      lastError = err;
    }
  }

  throw new Error(`Todas las claves API de Gemini fallaron para embeddings. Último error: ${lastError?.message || 'Error desconocido'}`);
}

export const embeddingService = {
  /**
   * Genera un embedding vectorial de 384 dimensiones para un texto dado con rotación de claves.
   */
  getEmbedding: async (text: string): Promise<number[]> => {
    try {
      const response = await callEmbedContentWithFallback({
        model: 'gemini-embedding-001',
        contents: text,
        config: {
          outputDimensionality: 384,
        }
      });
      const embedding = response.embeddings?.[0]?.values;
      if (!embedding || embedding.length !== 384) {
        throw new Error(`Dimensión incorrecta o nula del embedding. Obtenido: ${embedding?.length}`);
      }
      return embedding;
    } catch (error) {
      console.error('Error al generar embedding con Gemini:', error);
      throw error;
    }
  },

  /**
   * Genera embeddings en lote con rotación de claves.
   */
  getEmbeddings: async (texts: string[]): Promise<number[][]> => {
    if (texts.length === 0) return [];
    try {
      const response = await callEmbedContentWithFallback({
        model: 'gemini-embedding-001',
        contents: texts,
        config: {
          outputDimensionality: 384,
        }
      });
      
      const embeddings = response.embeddings?.map(e => e.values) as number[][];
      return embeddings;
    } catch (error) {
      console.warn('Fallo en la extracción de embeddings en lote, reintentando secuencialmente:', error);
      const results: number[][] = [];
      for (const text of texts) {
        results.push(await embeddingService.getEmbedding(text));
      }
      return results;
    }
  }
};
