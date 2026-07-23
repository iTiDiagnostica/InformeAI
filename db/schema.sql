-- Crear extensión para búsqueda vectorial si no existe
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabla para almacenar los perfiles de los médicos
CREATE TABLE IF NOT EXISTS doctors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    specialty VARCHAR(255) NOT NULL,
    style_directives TEXT, -- Instrucciones de estilo del médico para el LLM
    folder_name VARCHAR(255) UNIQUE, -- Carpeta física del disco asociada (ej: DR ARAOZ)
    username VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    company_id INT, -- Relación con la empresa/institución (agregado dinámicamente)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para almacenar los documentos de referencia / guías de estudio
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    doctor_id INT REFERENCES doctors(id) ON DELETE CASCADE, -- Opcional, si está asociada a un médico
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para almacenar los fragmentos (chunks) y sus embeddings vectoriales
CREATE TABLE IF NOT EXISTS document_chunks (
    id SERIAL PRIMARY KEY,
    document_id INT REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(384), -- Utiliza 384 dimensiones para el modelo MiniLM-L6-v2
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para almacenar el historial de informes dictados y estructurados
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    doctor_id INT REFERENCES doctors(id) ON DELETE SET NULL, -- Médico que emitió/editó el informe
    raw_text TEXT NOT NULL,
    structured_text TEXT NOT NULL,
    report_type VARCHAR(255),
    created_by_role VARCHAR(100) DEFAULT 'Invitado',
    ai_type VARCHAR(100),
    rating INT DEFAULT 0,
    is_exemplar BOOLEAN DEFAULT FALSE,
    exemplar_embedding vector(384),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para almacenar el feedback explícito del médico (Thumbs Up / Down)
CREATE TABLE IF NOT EXISTS report_feedback (
    id SERIAL PRIMARY KEY,
    report_id INT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    doctor_id INT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    rating INT NOT NULL, -- 1 (Thumbs Up) o -1 (Thumbs Down)
    feedback_tag VARCHAR(100),
    user_comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para almacenar revisiones y diffs de informes
CREATE TABLE IF NOT EXISTS report_revisions (
    id SERIAL PRIMARY KEY,
    report_id INT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    doctor_id INT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    ai_generated_text TEXT NOT NULL,
    final_edited_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índice para acelerar la búsqueda por similitud de coseno en los embeddings
CREATE INDEX IF NOT EXISTS document_chunks_embedding_cosine_idx 
ON document_chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS reports_exemplar_embedding_idx 
ON reports USING hnsw (exemplar_embedding vector_cosine_ops)
WHERE is_exemplar = TRUE;

-- Tabla para almacenar configuraciones globales del sistema (ej: active_ai_model)
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL
);

-- Insertar valor por defecto de IA activa (Gemma) si no existe
INSERT INTO system_settings (key, value) VALUES ('active_ai_model', 'gemma') ON CONFLICT (key) DO NOTHING;


