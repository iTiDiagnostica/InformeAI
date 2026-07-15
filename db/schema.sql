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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índice para acelerar la búsqueda por similitud de coseno en los embeddings
CREATE INDEX IF NOT EXISTS document_chunks_embedding_cosine_idx 
ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- Tabla para almacenar configuraciones globales del sistema (ej: active_ai_model)
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL
);

-- Insertar valor por defecto de IA activa (Gemma) si no existe
INSERT INTO system_settings (key, value) VALUES ('active_ai_model', 'gemma') ON CONFLICT (key) DO NOTHING;

