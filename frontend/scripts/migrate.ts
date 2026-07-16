import { loadEnvConfig } from '@next/env';
import path from 'path';

// Cargar variables de entorno usando el cargador nativo de Next.js
const projectDir = path.resolve(process.cwd());
loadEnvConfig(projectDir);

import { db, testConnection } from '../src/services/dbService';

async function runMigration() {
  console.log('🚀 Iniciando proceso de migración de base de datos...');
  
  try {
    // 1. Habilitar extensión vector en Postgres (requerido por RAG)
    console.log('🔄 Verificando extensión "vector" en base de datos...');
    await db.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('✅ Extensión "vector" habilitada con éxito.');

    // 2. Ejecutar esquema principal y semillas del dbService
    console.log('🔄 Ejecutando migraciones de tablas y relaciones...');
    const migrationSuccess = await testConnection(3, 1000);
    
    if (migrationSuccess) {
      console.log('✨ Proceso de migración completado exitosamente.');
      process.exit(0);
    } else {
      console.error('❌ El proceso de migración falló al establecer la conexión.');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ Error fatal durante la migración:', error.message || error);
    process.exit(1);
  }
}

runMigration();
