import { GoogleGenAI } from '@google/genai';


const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

if (!GEMINI_API_KEY) {
  console.warn('⚠️ GEMINI_API_KEY no está configurada. Los embeddings fallarán si se intentan usar.');
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export const embeddingService = {
  /**
   * Genera un embedding vectorial de 384 dimensiones para un texto dado.
   * Usamos el parámetro outputDimensionality soportado por text-embedding-004.
   */
  getEmbedding: async (text: string): Promise<number[]> => {
    try {
      const response = await ai.models.embedContent({
        model: 'text-embedding-004',
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
   * Genera embeddings en lote.
   */
  getEmbeddings: async (texts: string[]): Promise<number[][]> => {
    if (texts.length === 0) return [];
    try {
      const response = await ai.models.embedContent({
        model: 'text-embedding-004',
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

