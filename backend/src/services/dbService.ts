import { Pool } from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL no está configurada en .env. El servidor no puede arrancar sin conexión a la base de datos.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Registrar manejadores de error globales del pool
pool.on('error', (err) => {
  console.error('Error inesperado en el cliente de PostgreSQL:', err);
});

export const db = {
  query: (text: string, params?: any[]) => pool.query(text, params),
  getPool: () => pool,
};

// Función para testear y asegurar que la base de datos está activa
export async function testConnection(retries = 5, delay = 2000): Promise<boolean> {
  while (retries > 0) {
    try {
      await db.query('SELECT 1');
      console.log('✅ Conexión exitosa a PostgreSQL');      // 1. Crear tabla de empresas
      await db.query(`
        CREATE TABLE IF NOT EXISTS companies (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            logo_base64 TEXT,
            favicon_base64 TEXT,
            color_primary VARCHAR(100) DEFAULT 'oklch(0.12 0.015 195)',
            color_secondary VARCHAR(100) DEFAULT 'oklch(0.16 0.018 195)',
            color_accent VARCHAR(100) DEFAULT 'oklch(0.70 0.13 185)',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Seed default companies
      await db.query(`
        INSERT INTO companies (name, color_primary, color_secondary, color_accent)
        VALUES ('Sistema', 'oklch(0.12 0.015 195)', 'oklch(0.16 0.018 195)', 'oklch(0.70 0.13 185)')
        ON CONFLICT (name) DO NOTHING;
      `);
      await db.query(`
        INSERT INTO companies (name, color_primary, color_secondary, color_accent)
        VALUES ('Imagen Diagnóstica', 'oklch(0.12 0.015 195)', 'oklch(0.16 0.018 195)', 'oklch(0.70 0.13 185)')
        ON CONFLICT (name) DO NOTHING;
      `);

      // Migraciones automáticas de la tabla doctors, documents y reports
      await db.query(`
        CREATE TABLE IF NOT EXISTS moderators (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            username VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await db.query('ALTER TABLE doctors ADD COLUMN IF NOT EXISTS username VARCHAR(255) UNIQUE;');
      await db.query('ALTER TABLE doctors ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);');
      await db.query('ALTER TABLE doctors ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) ON DELETE SET NULL;');
      await db.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) ON DELETE CASCADE;');
      await db.query('ALTER TABLE reports ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) ON DELETE SET NULL;');
      await db.query('ALTER TABLE companies ADD COLUMN IF NOT EXISTS favicon_base64 TEXT;');
      
      // Asignar nombres de usuario y contraseñas por defecto a los médicos preexistentes
      // Usar bcrypt para el hash de la contraseña por defecto
      const defaultDoctorPassword = process.env.DEFAULT_DOCTOR_PASSWORD || 'CambiarMe2026!';
      const defaultPwHash = bcrypt.hashSync(defaultDoctorPassword, 12);
      const migratedResult = await db.query(`
        UPDATE doctors
        SET username = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g')),
            password_hash = $1
        WHERE username IS NULL
        RETURNING id;
      `, [defaultPwHash]);
      if (migratedResult.rowCount && migratedResult.rowCount > 0) {
        console.warn(`⚠️ ${migratedResult.rowCount} médico(s) preexistente(s) recibieron la contraseña por defecto. Solicite que cambien su contraseña.`);
      }
      console.log('✅ Base de datos: Tabla companies y relaciones de company_id verificadas/migradas.');
      return true;
    } catch (err) {
      console.warn(`⚠️ Error conectando a Postgres. Reintentos restantes: ${retries}...`);
      retries--;
      if (retries === 0) {
        console.error('❌ No se pudo conectar a Postgres:', err);
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return false;
}
