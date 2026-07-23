import { db } from './dbService';
import { embeddingService } from './embeddingService';

/**
 * Utilidad para dividir texto en fragmentos (chunks) con solapamiento,
 * intentando respetar límites de oraciones o párrafos.
 */
function chunkText(text: string, maxChars = 800, overlap = 150): string[] {
  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = startIndex + maxChars;
    if (endIndex >= text.length) {
      chunks.push(text.slice(startIndex).trim());
      break;
    }

    // Intentar cortar en un punto limpio (fin de oración o salto de línea) en la zona de solapamiento
    const slice = text.slice(startIndex, endIndex);
    const lastBoundary = Math.max(
      slice.lastIndexOf('. '),
      slice.lastIndexOf('\n'),
      slice.lastIndexOf('; ')
    );

    // Si encontramos un límite limpio dentro del umbral de solapamiento, recortamos ahí
    if (lastBoundary > maxChars - overlap && lastBoundary !== -1) {
      endIndex = startIndex + lastBoundary + 1;
    }

    const chunk = text.slice(startIndex, endIndex).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    
    // Desplazar el índice de inicio restando el solapamiento
    startIndex = Math.max(startIndex + 1, endIndex - overlap);
  }
  return chunks.filter(c => c.length > 5);
}
export const ragService = {
  /**
   * Ingiere un documento: guarda el documento, lo divide en fragmentos,
   * genera embeddings para cada fragmento de forma local en lote y los guarda en base de datos.
   */
  ingestDocument: async (title: string, content: string, doctorId: number | null = null, companyId: number | null = null): Promise<number> => {
    const client = await db.getPool().connect();
    try {
      await client.query('BEGIN');

      // 1. Guardar el documento padre
      const docResult = await client.query(
        'INSERT INTO documents (title, content, doctor_id, company_id) VALUES ($1, $2, $3, $4) RETURNING id',
        [title, content, doctorId, companyId]
      );
      const documentId = docResult.rows[0].id;

      // 2. Fragmentar el documento
      const chunks = chunkText(content);
      console.log(`📄 Documento "${title}" fragmentado en ${chunks.length} chunks.`);

      // 3. Generar embeddings en lote
      const embeddings = await embeddingService.getEmbeddings(chunks);

      // 4. Insertar fragmentos
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];
        const vectorStr = `[${embedding.join(',')}]`;
        
        await client.query(
          'INSERT INTO document_chunks (document_id, content, embedding) VALUES ($1, $2, $3::vector)',
          [documentId, chunk, vectorStr]
        );
      }

      await client.query('COMMIT');
      return documentId;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Error ingiriendo el documento "${title}":`, error);
      throw error;
    } finally {
      client.release();
    }
  },

  updateDocument: async (id: number, title: string, content: string, doctorId: number | null = null, companyId: number | null = null): Promise<void> => {
    const client = await db.getPool().connect();
    try {
      await client.query('BEGIN');

      // 1. Actualizar el documento padre
      await client.query(
        'UPDATE documents SET title = $1, content = $2, doctor_id = $3, company_id = $4 WHERE id = $5',
        [title, content, doctorId, companyId, id]
      );

      // 2. Eliminar fragmentos anteriores
      await client.query('DELETE FROM document_chunks WHERE document_id = $1', [id]);

      // 3. Fragmentar el nuevo contenido
      const chunks = chunkText(content);
      console.log(`📄 Documento ID ${id} ("${title}") re-fragmentado en ${chunks.length} chunks.`);

      // 4. Generar nuevos embeddings en lote e insertar fragmentos
      const embeddings = await embeddingService.getEmbeddings(chunks);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];
        const vectorStr = `[${embedding.join(',')}]`;
        
        await client.query(
          'INSERT INTO document_chunks (document_id, content, embedding) VALUES ($1, $2, $3::vector)',
          [id, chunk, vectorStr]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Error actualizando el documento ID ${id}:`, error);
      throw error;
    } finally {
      client.release();
    }
  },
  searchContext: async (queryText: string, limit = 3, doctorId: number | null = null, companyId: number | null = null): Promise<{ context: string; detectedDoctorId: number | null; matchFound: boolean }> => {
    try {
      // 1. Generar embedding para la consulta del usuario
      const queryEmbedding = await embeddingService.getEmbedding(queryText);
      const vectorStr = `[${queryEmbedding.join(',')}]`;

      // 2. Realizar búsqueda vectorial de similitud de coseno agrupando por documento completo
      let query = `
        SELECT d.id, d.title, d.content, d.doctor_id, MIN(dc.embedding <=> $1::vector) as min_distance
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
      `;
      const queryParams = [vectorStr, limit];
      const conditions: string[] = [];

      if (doctorId !== null) {
        conditions.push(`(d.doctor_id = $${queryParams.length + 1} OR d.doctor_id IS NULL)`);
        queryParams.push(doctorId);
      }
      
      if (companyId !== null) {
        conditions.push(`(d.company_id = $${queryParams.length + 1} OR d.company_id IS NULL)`);
        queryParams.push(companyId);
      }

      if (conditions.length > 0) {
        query += ` WHERE ` + conditions.join(' AND ');
      }

      query += ` GROUP BY d.id, d.title, d.content, d.doctor_id ORDER BY min_distance ASC LIMIT $2`;

      const result = await db.query(query, queryParams);

      // 3. Unir y formatear el contexto recuperado
      if (result.rows.length === 0) {
        return {
          context: 'No se encontraron plantillas o guías de estudio relevantes.',
          detectedDoctorId: null,
          matchFound: false
        };
      }

      const firstDistance = parseFloat(result.rows[0].min_distance);
      const RAG_DISTANCE_THRESHOLD = 0.5;

      if (firstDistance >= RAG_DISTANCE_THRESHOLD) {
        console.log(`⚠️ RAG: La mejor distancia es de ${firstDistance.toFixed(4)}, que supera el límite de relevancia de ${RAG_DISTANCE_THRESHOLD}. No se considera coincidencia.`);
        return {
          context: 'No se encontraron plantillas o guías de estudio relevantes.',
          detectedDoctorId: null,
          matchFound: false
        };
      }

      // El documento más similar (primer elemento) determina el médico auto-detectado
      const detectedDoctorId = result.rows[0].doctor_id || null;

      const filteredRows = result.rows.filter((row, index) => {
        if (index === 0) return true; // Siempre conservar el mejor match
        const dist = parseFloat(row.min_distance);
        // Conservar el documento si tiene una distancia baja (alta similitud, ej. similitud >= 0.52 -> distancia <= 0.48)
        // O si su distancia está muy cercana a la del primer documento (diferencia < 0.05)
        return dist <= 0.48 || (dist - firstDistance) < 0.05;
      });

      console.log(`🔍 RAG: De ${result.rows.length} plantillas encontradas, se conservaron ${filteredRows.length} por relevancia (Mejor distancia: ${firstDistance.toFixed(4)}).`);

      const formattedContext = filteredRows
        .map((row, index) => `[Plantilla de Referencia ${index + 1} - "${row.title}" (Similitud: ${(1 - parseFloat(row.min_distance)).toFixed(4)})]\n${row.content}`)
        .join('\n\n---\n\n');

      return {
        context: formattedContext,
        detectedDoctorId,
        matchFound: true
      };
    } catch (error) {
      console.error('Error al recuperar contexto para RAG:', error);
      return {
        context: '',
        detectedDoctorId: null,
        matchFound: false
      };
    }
  },

  /**
   * Búsqueda RAG de informes modélicos (Thumbs Up / Ejemplares) exclusivos del médico (doctor_id).
   */
  searchDoctorExemplars: async (queryText: string, doctorId: number, limit = 2): Promise<string[]> => {
    if (!doctorId) return [];
    try {
      const queryEmbedding = await embeddingService.getEmbedding(queryText);
      const vectorStr = `[${queryEmbedding.join(',')}]`;

      const query = `
        SELECT report_type, structured_text, (exemplar_embedding <=> $1::vector) as distance
        FROM reports
        WHERE doctor_id = $2 AND is_exemplar = TRUE AND exemplar_embedding IS NOT NULL
        ORDER BY distance ASC
        LIMIT $3
      `;
      const result = await db.query(query, [vectorStr, doctorId, limit]);
      return result.rows.map((row: any) => `[Ejemplo Modélico del Médico - ${row.report_type || 'Informe'}]\n${row.structured_text}`);
    } catch (err) {
      console.error('Error buscando informes modélicos del médico:', err);
      return [];
    }
  },

  /**
   * Guarda y genera embedding para un informe modélico (Thumbs Up / Excelente) de un médico.
   */
  saveDoctorExemplar: async (reportId: number, doctorId: number): Promise<void> => {
    try {
      const repRes = await db.query('SELECT structured_text FROM reports WHERE id = $1 AND doctor_id = $2', [reportId, doctorId]);
      if (repRes.rows.length === 0) return;
      const text = repRes.rows[0].structured_text;
      const embedding = await embeddingService.getEmbedding(text);
      const vectorStr = `[${embedding.join(',')}]`;
      await db.query(
        'UPDATE reports SET is_exemplar = TRUE, rating = 1, exemplar_embedding = $1::vector WHERE id = $2',
        [vectorStr, reportId]
      );
    } catch (err) {
      console.error('Error guardando informe modélico:', err);
    }
  }
};


