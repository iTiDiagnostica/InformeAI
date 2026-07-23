-- Habilitar extensión de vectores para RAG
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Tabla de Empresas (Tenants)
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

-- Sembrar empresas por defecto
INSERT INTO companies (name, color_primary, color_secondary, color_accent)
VALUES ('Sistema', 'oklch(0.12 0.015 195)', 'oklch(0.16 0.018 195)', 'oklch(0.70 0.13 185)')
ON CONFLICT (name) DO NOTHING;

INSERT INTO companies (name, color_primary, color_secondary, color_accent)
VALUES ('Imagen Diagnóstica', 'oklch(0.12 0.015 195)', 'oklch(0.16 0.018 195)', 'oklch(0.70 0.13 185)')
ON CONFLICT (name) DO NOTHING;

-- 2. Tabla de Médicos (Doctors)
CREATE TABLE IF NOT EXISTS doctors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    specialty VARCHAR(255) NOT NULL,
    style_directives TEXT, -- Instrucciones de estilo del médico para el LLM
    folder_name VARCHAR(255) UNIQUE, -- Carpeta física asociada
    username VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    company_id INT REFERENCES companies(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Moderadores
CREATE TABLE IF NOT EXISTS moderators (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla de Documentos (Plantillas de Referencia / Guías)
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    doctor_id INT REFERENCES doctors(id) ON DELETE CASCADE, -- Opcional, asociada a un médico
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tabla de fragmentos (chunks) y sus embeddings vectoriales
CREATE TABLE IF NOT EXISTS document_chunks (
    id SERIAL PRIMARY KEY,
    document_id INT REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(384), -- Utiliza 384 dimensiones para el modelo text-embedding-004 / MiniLM
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índice para acelerar la búsqueda por similitud de coseno en los embeddings
CREATE INDEX IF NOT EXISTS document_chunks_embedding_cosine_idx 
ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- 6. Tabla de Informes Estructurados
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    doctor_id INT REFERENCES doctors(id) ON DELETE SET NULL, -- Médico emisor
    raw_text TEXT NOT NULL,
    structured_text TEXT NOT NULL,
    report_type VARCHAR(255),
    created_by_role VARCHAR(100) DEFAULT 'Invitado',
    ai_type VARCHAR(100),
    company_id INT REFERENCES companies(id) ON DELETE SET NULL,
    rating INT DEFAULT 0, -- 1: Thumbs Up (Excelente), -1: Thumbs Down (Inadecuado), 0: Sin evaluar
    is_exemplar BOOLEAN DEFAULT FALSE, -- Indica si es una plantilla/ejemplo modélico aprobado por el médico
    exemplar_embedding vector(384), -- Embedding para RAG dinámico Few-Shot por médico
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Alterar la tabla por si ya existe
ALTER TABLE reports ADD COLUMN IF NOT EXISTS rating INT DEFAULT 0;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS is_exemplar BOOLEAN DEFAULT FALSE;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS exemplar_embedding vector(384);

-- Índice vectorial sobre informes modélicos por médico
CREATE INDEX IF NOT EXISTS reports_exemplar_embedding_idx 
ON reports USING hnsw (exemplar_embedding vector_cosine_ops)
WHERE is_exemplar = TRUE;

-- 7. Tabla de Feedback del Médico (Thumbs Up / Down)
CREATE TABLE IF NOT EXISTS report_feedback (
    id SERIAL PRIMARY KEY,
    report_id INT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    doctor_id INT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    rating INT NOT NULL, -- 1 (Thumbs Up) o -1 (Thumbs Down)
    feedback_tag VARCHAR(100), -- Ej: 'estilo_incorrecto', 'alucinacion', 'excelente'
    user_comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Tabla de Revisiones y Diffs
CREATE TABLE IF NOT EXISTS report_revisions (
    id SERIAL PRIMARY KEY,
    report_id INT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    doctor_id INT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    ai_generated_text TEXT NOT NULL,
    final_edited_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Tabla de Configuraciones del Sistema
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL
);

-- Modelo de IA activo por defecto (gemma / gemini)
INSERT INTO system_settings (key, value)
VALUES ('active_ai_model', 'gemma')
ON CONFLICT (key) DO NOTHING;
