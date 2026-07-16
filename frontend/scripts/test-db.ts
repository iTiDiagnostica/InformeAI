import { loadEnvConfig } from '@next/env';
import path from 'path';

// Cargar variables de entorno usando el cargador nativo de Next.js
const projectDir = path.resolve(process.cwd());
loadEnvConfig(projectDir);

import { db } from '../src/services/dbService';

async function testDatabase() {
  console.log('🔄 Probando conexión a la base de datos PostgreSQL...');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL no está configurada.');
    process.exit(1);
  }
  
  try {
    const start = Date.now();
    const result = await db.query('SELECT 1 + 1 AS result');
    const elapsed = Date.now() - start;
    
    console.log(`✅ Conexión exitosa a la base de datos.`);
    console.log(`📊 Resultado de query simple: ${result.rows[0].result}`);
    console.log(`⏱️  Tiempo de respuesta: ${elapsed}ms`);
    
    // Probar si la extensión de vectores está disponible
    const vectorCheck = await db.query("SELECT extname FROM pg_extension WHERE extname = 'vector'");
    if (vectorCheck.rows.length > 0) {
      console.log('✅ Extensión "vector" (pgvector) está instalada y activa.');
    } else {
      console.warn('⚠️ Advertencia: la extensión "vector" no se encuentra activa en esta base de datos.');
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error al conectar a la base de datos:', error.message || error);
    process.exit(1);
  }
}

testDatabase();
