// Servicio para generar embeddings usando @huggingface/transformers localmente en CPU
let extractorInstance: any = null;

// Inicializa o retorna la instancia del extractor (patrón Singleton)
async function getExtractor() {
  if (!extractorInstance) {
    console.log('🔄 Inicializando modelo de embeddings local (MiniLM-L6-v2)...');
    try {
      // Importación dinámica para asegurar compatibilidad ESM / CommonJS
      const { pipeline } = await import('@huggingface/transformers');
      extractorInstance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      console.log('✅ Modelo de embeddings cargado correctamente.');
    } catch (error) {
      console.error('❌ Error al inicializar el modelo de embeddings:', error);
      throw error;
    }
  }
  return extractorInstance;
}
export const embeddingService = {
  /**
   * Genera un embedding vectorial de 384 dimensiones para un texto dado.
   */
  getEmbedding: async (text: string): Promise<number[]> => {
    try {
      const extractor = await getExtractor();
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      const embedding = Array.from(output.data) as number[];
      if (embedding.length !== 384) {
        throw new Error(`Dimensión incorrecta del embedding: se esperaba 384, se obtuvo ${embedding.length}`);
      }
      return embedding;
    } catch (error) {
      console.error('Error al generar embedding para el texto:', error);
      throw error;
    }
  },

  /**
   * Genera embeddings en lote para reducir el bloqueo de CPU y mejorar tiempos de respuesta
   */
  getEmbeddings: async (texts: string[]): Promise<number[][]> => {
    if (texts.length === 0) return [];
    try {
      const extractor = await getExtractor();
      const output = await extractor(texts, { pooling: 'mean', normalize: true });
      
      const batchSize = texts.length;
      const dimension = 384;
      const rawData = Array.from(output.data) as number[];
      const results: number[][] = [];
      
      for (let i = 0; i < batchSize; i++) {
        const start = i * dimension;
        const end = start + dimension;
        const embedding = rawData.slice(start, end);
        if (embedding.length !== dimension) {
          throw new Error(`Dimensión incorrecta del embedding en lote para el índice ${i}`);
        }
        results.push(embedding);
      }
      return results;
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
