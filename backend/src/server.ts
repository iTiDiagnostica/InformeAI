import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import os from 'os';
import multer from 'multer';
import mammoth from 'mammoth';
import pdf = require('pdf-parse');
import WordExtractor = require('word-extractor');
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { db, testConnection } from './services/dbService';
import { ragService } from './services/ragService';
import { llmService } from './services/llmService';
import { whisperService } from './services/whisperService';
import { embeddingService } from './services/embeddingService';

dotenv.config();

// ==========================================
// Validación de Seguridad al Arranque
// ==========================================
function validateSecurityConfig(): void {
  const required: { key: string; label: string; minLength?: number }[] = [
    { key: 'JWT_SECRET', label: 'Secreto JWT', minLength: 32 },
    { key: 'ADMIN_USERNAME', label: 'Usuario administrador' },
    { key: 'ADMIN_PASSWORD', label: 'Contraseña de administrador', minLength: 8 },
    { key: 'ADMIN_TOKEN', label: 'Token de administrador', minLength: 32 },
    { key: 'DATABASE_URL', label: 'URL de base de datos' },
  ];

  const errors: string[] = [];

  for (const { key, label, minLength } of required) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      errors.push(`  ❌ ${key} — ${label} no está configurado en .env`);
    } else if (minLength && value.length < minLength) {
      errors.push(`  ⚠️ ${key} — ${label} es demasiado corto (mín. ${minLength} caracteres)`);
    }
  }

  if (errors.length > 0) {
    console.error('\n🔒 ════════════════════════════════════════════════');
    console.error('🔒 ERROR DE CONFIGURACIÓN DE SEGURIDAD');
    console.error('🔒 ════════════════════════════════════════════════');
    console.error('Las siguientes variables de entorno son obligatorias:\n');
    errors.forEach(e => console.error(e));
    console.error('\nConfigure estas variables en el archivo .env y reinicie el servidor.');
    console.error('Consulte .env.example para referencia.\n');
    process.exit(1);
  }

  console.log('🔒 Validación de seguridad completada — todas las variables críticas están configuradas.');
}

validateSecurityConfig();

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// Middlewares de Seguridad
// ==========================================

// Headers de seguridad HTTP
app.use(helmet({
  contentSecurityPolicy: false, // Desactivado para permitir recursos del frontend
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// CORS restringido a orígenes permitidos
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

// Agregar IP de red local si se detecta
if (process.env.NEXT_PUBLIC_API_URL) {
  try {
    const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL);
    const frontendUrl = `${apiUrl.protocol}//${apiUrl.hostname}:3000`;
    if (!allowedOrigins.includes(frontendUrl)) {
      allowedOrigins.push(frontendUrl);
    }
  } catch { /* URL inválida, ignorar */ }
}

// Detectar y agregar IPs de red local automáticamente
try {
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName of Object.keys(networkInterfaces)) {
    const interfaces = networkInterfaces[interfaceName] || [];
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const localOrigin = `http://${iface.address}:3000`;
        if (!allowedOrigins.includes(localOrigin)) {
          allowedOrigins.push(localOrigin);
        }
      }
    }
  }
} catch (error) {
  console.error('Error al detectar IPs locales:', error);
}

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (ej: herramientas de desarrollo, Postman, apps móviles)
    if (!origin) {
      return callback(null, true);
    }

    const isAllowed = allowedOrigins.some(allowed => origin.startsWith(allowed.replace(':3000', '')));
    
    // Verificar si es una IP de red local típica
    let isLocalIp = false;
    try {
      const url = new URL(origin);
      const host = url.hostname;
      isLocalIp = host === 'localhost' || 
                  host === '127.0.0.1' || 
                  host.startsWith('192.168.') || 
                  host.startsWith('10.') || 
                  /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);
    } catch {
      isLocalIp = false;
    }

    if (isAllowed || isLocalIp) {
      callback(null, true);
    } else {
      callback(null, true); // En red local, ser permisivo pero logear
      console.warn(`⚠️ CORS: Origen no reconocido: ${origin}`);
    }
  },
  credentials: true,
}));

// Rate limiting global
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 200, // máx 200 requests por minuto por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intente nuevamente en un momento.' },
});
app.use(globalLimiter);

// Rate limiting estricto para el endpoint de login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máx 10 intentos de login por IP en 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Intente nuevamente en 15 minutos.' },
});

app.use(express.json({ limit: '10mb' })); // Permitir subidas de texto grandes para las plantillas

// ==========================================
// Criptografía y Sesiones sin dependencias
// ==========================================
export interface AuthenticatedRequest extends Request {
  user?: {
    role: 'admin' | 'doctor' | 'moderator';
    doctorId?: number;
    moderatorId?: number;
    companyId?: number;
  };
}

const SECRET = process.env.JWT_SECRET!;
const BCRYPT_ROUNDS = 12;

function hashPasswordSync(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // Migración progresiva: detectar si el hash es SHA-256 legacy (64 chars hex)
  const isSha256 = /^[a-f0-9]{64}$/.test(storedHash);
  if (isSha256) {
    const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
    return sha256Hash === storedHash;
  }
  // Hash bcrypt moderno
  return bcrypt.compare(password, storedHash);
}

async function migratePasswordIfNeeded(userId: number, table: 'doctors' | 'moderators', password: string, storedHash: string): Promise<void> {
  const isSha256 = /^[a-f0-9]{64}$/.test(storedHash);
  if (isSha256) {
    // Re-hashear con bcrypt para migración progresiva
    const newHash = await hashPassword(password);
    await db.query(`UPDATE ${table} SET password_hash = $1 WHERE id = $2`, [newHash, userId]);
    console.log(`🔒 Contraseña de ${table} ID ${userId} migrada de SHA-256 a bcrypt.`);
  }
}

function validatePasswordComplexity(password: string): string | null {
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  return null;
}

function generateDoctorToken(doctorId: number): string {
  const signature = crypto.createHmac('sha256', SECRET).update(doctorId.toString()).digest('hex');
  return `doctor-${doctorId}-${signature}`;
}

function verifyDoctorToken(token: string): number | null {
  if (!token.startsWith('doctor-')) return null;
  const parts = token.split('-');
  if (parts.length !== 3) return null;
  const doctorIdStr = parts[1];
  const signature = parts[2];
  const expectedSignature = crypto.createHmac('sha256', SECRET).update(doctorIdStr).digest('hex');
  if (signature === expectedSignature) {
    return parseInt(doctorIdStr);
  }
  return null;
}

function generateModeratorToken(moderatorId: number, companyId: number): string {
  const payload = `${moderatorId}-${companyId}`;
  const signature = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return `moderator-${payload}-${signature}`;
}

function verifyModeratorToken(token: string): { moderatorId: number; companyId: number } | null {
  if (!token.startsWith('moderator-')) return null;
  const parts = token.split('-');
  if (parts.length !== 4) return null;
  const moderatorIdStr = parts[1];
  const companyIdStr = parts[2];
  const signature = parts[3];
  const payload = `${moderatorIdStr}-${companyIdStr}`;
  const expectedSignature = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  if (signature === expectedSignature) {
    return {
      moderatorId: parseInt(moderatorIdStr),
      companyId: parseInt(companyIdStr)
    };
  }
  return null;
}

// Middleware de Autenticación Unificado (Admin / Médico / Moderador)
function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acceso denegado. No se proporcionó token.' });
  }

  const token = authHeader.split(' ')[1];
  const expectedAdminToken = process.env.ADMIN_TOKEN!;
  
  const authReq = req as AuthenticatedRequest;

  if (token === expectedAdminToken) {
    authReq.user = { role: 'admin' };
    return next();
  }

  const doctorId = verifyDoctorToken(token);
  if (doctorId !== null) {
    authReq.user = { role: 'doctor', doctorId };
    return next();
  }

  const modData = verifyModeratorToken(token);
  if (modData !== null) {
    authReq.user = { role: 'moderator', moderatorId: modData.moderatorId, companyId: modData.companyId };
    return next();
  }

  return res.status(401).json({ error: 'Acceso denegado. Token inválido o expirado.' });
}

// Middleware de Autenticación de Administrador Exclusivo
function authenticateAdmin(req: Request, res: Response, next: NextFunction) {
  authenticate(req, res, () => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de Administrador.' });
    }
    next();
  });
}

// Middleware de Autenticación de Administrador o Moderador
function authenticateAdminOrModerator(req: Request, res: Response, next: NextFunction) {
  authenticate(req, res, () => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== 'admin' && authReq.user?.role !== 'moderator') {
      return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de Administrador o Moderador.' });
    }
    next();
  });
}

// Endpoint de inicio de sesión unificado (Administrador / Médico)
app.post('/api/auth/login', loginLimiter, async (req: Request, res: Response) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Por favor, ingrese usuario y contraseña.' });
  }

  const expectedAdminUsername = process.env.ADMIN_USERNAME!;
  const expectedAdminPassword = process.env.ADMIN_PASSWORD!;
  const adminToken = process.env.ADMIN_TOKEN!;

  // 1. Verificar si es Administrador
  if (username === expectedAdminUsername && password === expectedAdminPassword) {
    return res.json({ token: adminToken, role: 'admin' });
  }

  try {
    // Verificación de contraseñas con soporte de migración progresiva SHA-256 → bcrypt

    // 2. Verificar si es Moderador en la base de datos
    const modResult = await db.query(
      `SELECT m.id, m.name, m.password_hash, m.company_id, c.name as company_name, c.logo_base64, c.favicon_base64, c.color_primary, c.color_secondary, c.color_accent
       FROM moderators m
       LEFT JOIN companies c ON m.company_id = c.id
       WHERE m.username = $1`,
      [username.trim()]
    );

    if (modResult.rows.length > 0) {
      const moderator = modResult.rows[0];
      const modPasswordValid = await verifyPassword(password, moderator.password_hash);
      if (modPasswordValid) {
        await migratePasswordIfNeeded(moderator.id, 'moderators', password, moderator.password_hash);
        const token = generateModeratorToken(moderator.id, moderator.company_id);
        const companyTheme = moderator.company_id ? {
          id: moderator.company_id,
          name: moderator.company_name,
          logo: moderator.logo_base64,
          favicon: moderator.favicon_base64,
          primary: moderator.color_primary,
          secondary: moderator.color_secondary,
          accent: moderator.color_accent
        } : null;

        return res.json({
          token,
          role: 'moderator',
          moderatorId: moderator.id,
          moderatorName: moderator.name,
          companyTheme
        });
      }
    }

    // 3. Verificar si es Médico en la base de datos
    const result = await db.query(
      `SELECT d.id, d.name, d.password_hash, d.company_id, c.name as company_name, c.logo_base64, c.favicon_base64, c.color_primary, c.color_secondary, c.color_accent
       FROM doctors d
       LEFT JOIN companies c ON d.company_id = c.id
       WHERE d.username = $1`,
      [username.trim()]
    );

    if (result.rows.length > 0) {
      const doctor = result.rows[0];
      const docPasswordValid = await verifyPassword(password, doctor.password_hash);
      if (docPasswordValid) {
        await migratePasswordIfNeeded(doctor.id, 'doctors', password, doctor.password_hash);
        const token = generateDoctorToken(doctor.id);
        
        const companyTheme = doctor.company_id ? {
          id: doctor.company_id,
          name: doctor.company_name,
          logo: doctor.logo_base64,
          favicon: doctor.favicon_base64,
          primary: doctor.color_primary,
          secondary: doctor.color_secondary,
          accent: doctor.color_accent
        } : null;

        return res.json({
          token,
          role: 'doctor',
          doctorId: doctor.id,
          doctorName: doctor.name,
          companyTheme
        });
      }
    }

    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  } catch (error: any) {
    console.error('Error en login de médico:', error);
    return res.status(500).json({ error: 'Error al procesar el inicio de sesión.' });
  }
});

// Configuración de Multer para carga de archivos de audio (en memoria)
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB máximo
  fileFilter: (_req, file, cb) => {
    // Aceptar múltiples formatos de audio
    const allowedMimes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave',
      'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/m4a', 'audio/x-m4a',
      'audio/flac', 'audio/x-flac', 'audio/aac', 'audio/x-aac',
      'audio/x-ms-wma', 'video/webm', 'video/mp4'
    ];
    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error(`Formato de audio no soportado: ${file.mimetype}. Use MP3, WAV, OGG, WEBM, M4A, FLAC, AAC o WMA.`));
    }
  }
});

// Configuración de Multer para carga de plantillas/documentos (en memoria)
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB máximo
  fileFilter: (_req, file, cb) => {
    const allowedExtensions = ['.docx', '.pdf', '.txt', '.doc', '.rtf'];
    const lowerName = file.originalname.toLowerCase();
    const hasAllowedExt = allowedExtensions.some(ext => lowerName.endsWith(ext));
    if (hasAllowedExt || file.mimetype === 'application/pdf' || file.mimetype.includes('word') || file.mimetype.includes('rtf') || file.mimetype.startsWith('text/')) {
      cb(null, true);
    } else {
      cb(new Error(`Formato de archivo no soportado. Use Word (.docx, .doc), RTF (.rtf), PDF (.pdf) o Texto plano (.txt).`));
    }
  }
});

// Ruta de diagnóstico simple
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==========================================
// RUTA 0: Transcripción de Audio (Whisper)
// ==========================================
app.post('/api/audio/transcribe', (req: Request, res: Response) => {
  // Envolver multer manualmente para capturar errores de archivo
  audioUpload.single('audio')(req, res, async (multerErr: any) => {
    if (multerErr) {
      console.error('Error de Multer:', multerErr.message);
      const msg = multerErr.code === 'LIMIT_FILE_SIZE'
        ? 'El archivo de audio excede el límite de 50 MB.'
        : multerErr.message || 'Error al procesar el archivo de audio.';
      return res.status(400).json({ error: msg });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo de audio. Asegúrese de enviar el campo "audio".' });
    }

    try {
      const fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf-8');
      console.log(`🎤 Audio recibido: ${fileName} (${(req.file.size / 1024).toFixed(1)} KB, ${req.file.mimetype})`);
      const transcription = await whisperService.transcribe(
        req.file.buffer,
        fileName,
        req.file.mimetype
      );

      res.json({ text: transcription });
    } catch (error: any) {
      console.error('Error en /api/audio/transcribe:', error.message);
      res.status(500).json({ error: error.message || 'Error al transcribir el audio.' });
    }
  });
});

// ==========================================
// RUTA 1: Ingesta de Documentos para RAG
// ==========================================
app.post('/api/documents/ingest', authenticate, async (req: Request, res: Response) => {
  const { title, content, doctorId, companyId } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: title o content.' });
  }

  const authReq = req as AuthenticatedRequest;
  let docIdNum = doctorId ? parseInt(doctorId) : null;
  let companyIdVal = companyId ? parseInt(companyId) : null;

  try {
    if (authReq.user?.role === 'doctor') {
      docIdNum = authReq.user.doctorId || null;
      // Obtener el company_id del médico
      const docRes = await db.query('SELECT company_id FROM doctors WHERE id = $1', [authReq.user.doctorId]);
      companyIdVal = docRes.rows[0]?.company_id || null;
    } else if (authReq.user?.role === 'moderator') {
      companyIdVal = authReq.user.companyId || null;
    }

    const documentId = await ragService.ingestDocument(title, content, docIdNum, companyIdVal);
    res.status(201).json({
      message: 'Documento ingerido y vectorizado exitosamente.',
      documentId
    });
  } catch (error: any) {
    console.error('Error en /api/documents/ingest:', error);
    res.status(500).json({ error: error.message || 'Error interno del servidor.' });
  }
});

// Obtener todos los documentos cargados
app.get('/api/documents', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    let sql = `
      SELECT d.id, d.title, char_length(d.content) as length, d.created_at, d.doctor_id as "doctorId", doc.name as "doctorName", d.company_id as "companyId", comp.name as "companyName"
      FROM documents d
      LEFT JOIN doctors doc ON d.doctor_id = doc.id
      LEFT JOIN companies comp ON d.company_id = comp.id
    `;
    const params: any[] = [];
    if (authReq.user?.role === 'doctor') {
      // Obtener el company_id del médico
      const docRes = await db.query('SELECT company_id FROM doctors WHERE id = $1', [authReq.user.doctorId]);
      const companyId = docRes.rows[0]?.company_id;

      sql += ' WHERE (d.doctor_id = $1 OR d.doctor_id IS NULL) AND (d.company_id = $2 OR d.company_id IS NULL)';
      params.push(authReq.user.doctorId, companyId);
    } else if (authReq.user?.role === 'moderator') {
      sql += ' WHERE (d.company_id = $1 OR d.company_id IS NULL)';
      params.push(authReq.user.companyId);
    }
    sql += ' ORDER BY d.created_at DESC';

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error recuperando documentos.' });
  }
});

// Obtener un documento por ID (contenido completo para edición)
app.get('/api/documents/:id', authenticate, async (req: Request, res: Response) => {
  const { id } = req.params;
  const authReq = req as AuthenticatedRequest;
  try {
    const result = await db.query(
      `SELECT d.id, d.title, d.content, d.created_at, d.doctor_id as "doctorId", d.company_id as "companyId"
       FROM documents d
       WHERE d.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Documento no encontrado.' });
    }

    const doc = result.rows[0];
    if (authReq.user?.role === 'doctor') {
      const docRes = await db.query('SELECT company_id FROM doctors WHERE id = $1', [authReq.user.doctorId]);
      const companyId = docRes.rows[0]?.company_id || null;

      if (doc.doctorId !== null && doc.doctorId !== authReq.user.doctorId) {
        return res.status(403).json({ error: 'Acceso denegado. No tiene permisos para ver esta plantilla.' });
      }
      if (doc.companyId !== null && doc.companyId !== companyId) {
        return res.status(403).json({ error: 'Acceso denegado. No tiene permisos para ver esta plantilla.' });
      }
    } else if (authReq.user?.role === 'moderator') {
      if (doc.companyId !== null && doc.companyId !== authReq.user.companyId) {
        return res.status(403).json({ error: 'Acceso denegado. No tiene permisos para ver esta plantilla.' });
      }
    }

    res.json(doc);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error recuperando documento.' });
  }
});

// Eliminar un documento de referencia
app.delete('/api/documents/:id', authenticate, async (req: Request, res: Response) => {
  const { id } = req.params;
  const authReq = req as AuthenticatedRequest;
  try {
    // Si es un médico, verificar que la plantilla le pertenezca
    if (authReq.user?.role === 'doctor') {
      const checkRes = await db.query('SELECT doctor_id FROM documents WHERE id = $1', [id]);
      if (checkRes.rows.length === 0) {
        return res.status(404).json({ error: 'Documento no encontrado.' });
      }
      if (checkRes.rows[0].doctor_id !== authReq.user.doctorId) {
        return res.status(403).json({ error: 'Acceso denegado. No tiene permisos para eliminar esta plantilla.' });
      }
    }

    await db.query('DELETE FROM documents WHERE id = $1', [id]);
    res.json({ message: 'Documento eliminado exitosamente.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error eliminando documento.' });
  }
});

// Limpia y convierte HTML de RTF en texto Markdown simple preservando negritas
function cleanHTML(html: string): string {
  let text = html;
  
  // Reemplazar etiquetas de negrita por **
  text = text.replace(/<(strong|b)\b[^>]*>/gi, '**');
  text = text.replace(/<\/(strong|b)>/gi, '**');
  
  // Reemplazar saltos de bloque por saltos de línea
  text = text.replace(/<p\b[^>]*>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<br\b[^>]*>/gi, '\n');
  text = text.replace(/<div\b[^>]*>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<tr\b[^>]*>/gi, '\n');
  text = text.replace(/<td\b[^>]*>/gi, ' ');
  
  // Eliminar el resto de etiquetas HTML
  text = text.replace(/<[^>]+>/g, '');
  
  // Decodificar entidades HTML comunes
  text = text.replace(/&nbsp;/g, ' ')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&amp;/g, '&')
             .replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'");
             
  // Normalizar saltos de línea
  const lines = text.split('\n');
  const cleanedLines = lines.map(line => line.trim());
  
  let result = '';
  let prevLineWasEmpty = false;
  for (const line of cleanedLines) {
    if (line === '') {
      if (!prevLineWasEmpty) {
        result += '\n';
        prevLineWasEmpty = true;
      }
    } else {
      if (result !== '') {
        result += '\n';
      }
      result += line;
      prevLineWasEmpty = false;
    }
  }
  
  return result.trim();
}

// ==========================================
// RUTA 1.2: Extracción de texto de documentos para plantillas
// ==========================================
app.post('/api/documents/parse', authenticate, (req: Request, res: Response) => {
  documentUpload.single('file')(req, res, async (multerErr: any) => {
    if (multerErr) {
      console.error('Error de Multer (documento):', multerErr.message);
      return res.status(400).json({ error: multerErr.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo. Asegúrese de enviar el campo "file".' });
    }

    try {
      // Corregir codificación UTF-8 mal interpretada como Latin1 (ISO-8859-1) por multer/busboy
      const fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf-8');
      const lowerName = fileName.toLowerCase();
      let content = '';

      console.log(`📄 Archivo recibido para parsear: ${fileName} (${(req.file.size / 1024).toFixed(1)} KB)`);

      if (lowerName.endsWith('.docx')) {
        try {
          const parseResult = await mammoth.extractRawText({ buffer: req.file.buffer });
          content = parseResult.value.trim();
        } catch (mammothErr: any) {
          try {
            const extractor = new WordExtractor();
            const doc = await extractor.extract(req.file.buffer);
            content = doc.getBody().trim();
          } catch {
            throw mammothErr;
          }
        }
      } else if (lowerName.endsWith('.pdf')) {
        const pdfData = await (pdf as any)(req.file.buffer);
        content = pdfData.text.trim();
      } else if (lowerName.endsWith('.txt')) {
        content = req.file.buffer.toString('utf-8').trim();
      } else if (lowerName.endsWith('.doc')) {
        try {
          const extractor = new WordExtractor();
          const doc = await extractor.extract(req.file.buffer);
          content = doc.getBody().trim();
        } catch (extractorErr: any) {
          try {
            const parseResult = await mammoth.extractRawText({ buffer: req.file.buffer });
            content = parseResult.value.trim();
          } catch {
            throw extractorErr;
          }
        }
      } else if (lowerName.endsWith('.rtf')) {
        const { parseRTF, toHTML } = await (Function('return import("@jonahschulte/rtf-toolkit")')() as Promise<any>);
        const parsed = parseRTF(req.file.buffer.toString('utf-8'));
        const html = toHTML(parsed);
        content = cleanHTML(html);
      } else {
        return res.status(400).json({ error: 'Formato de archivo no soportado. Use Word (.docx, .doc), RTF (.rtf), PDF (.pdf) o Texto plano (.txt).' });
      }

      // Nombre del archivo sin la extensión para usar de título por defecto
      const title = fileName.replace(/\.[^/.]+$/, "");

      res.json({ title, content });
    } catch (error: any) {
      console.error('Error en /api/documents/parse:', error.message);
      res.status(500).json({ error: error.message || 'Error al extraer el texto del archivo.' });
    }
  });
});

// Editar un documento de referencia (actualizar título, contenido y doctorId en RAG)
app.put('/api/documents/:id', authenticate, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, content, doctorId, companyId } = req.body;
  const authReq = req as AuthenticatedRequest;

  if (!title || !content) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: title o content.' });
  }

  try {
    // Si es un médico, verificar que la plantilla le pertenezca
    let docIdNum = doctorId ? parseInt(doctorId) : null;
    let companyIdVal = companyId ? parseInt(companyId) : null;
    if (authReq.user?.role === 'doctor') {
      const checkRes = await db.query('SELECT doctor_id FROM documents WHERE id = $1', [id]);
      if (checkRes.rows.length === 0) {
        return res.status(404).json({ error: 'Documento no encontrado.' });
      }
      if (checkRes.rows[0].doctor_id !== authReq.user.doctorId) {
        return res.status(403).json({ error: 'Acceso denegado. No tiene permisos para editar esta plantilla.' });
      }
      // Forzar que el doctorId y companyId sean del médico logueado
      docIdNum = authReq.user.doctorId || null;
      const docRes = await db.query('SELECT company_id FROM doctors WHERE id = $1', [authReq.user.doctorId]);
      companyIdVal = docRes.rows[0]?.company_id || null;
    } else if (authReq.user?.role === 'moderator') {
      const checkRes = await db.query('SELECT company_id FROM documents WHERE id = $1', [id]);
      if (checkRes.rows.length === 0) {
        return res.status(404).json({ error: 'Documento no encontrado.' });
      }
      if (checkRes.rows[0].company_id !== authReq.user.companyId) {
        return res.status(403).json({ error: 'Acceso denegado. No tiene permisos para editar esta plantilla.' });
      }
      companyIdVal = authReq.user.companyId || null;
    }

    await ragService.updateDocument(parseInt(id), title, content, docIdNum, companyIdVal);
    res.json({ message: 'Documento actualizado y re-vectorizado exitosamente.' });
  } catch (error: any) {
    console.error('Error en PUT /api/documents/:id:', error);
    res.status(500).json({ error: error.message || 'Error al actualizar el documento.' });
  }
});

// Ingestar múltiples documentos en lote
app.post('/api/documents/ingest-multiple', authenticate, (req: Request, res: Response) => {
  documentUpload.array('files', 100)(req, res, async (multerErr: any) => {
    if (multerErr) {
      console.error('Error de Multer (lote):', multerErr.message);
      return res.status(400).json({ error: multerErr.message });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No se recibieron archivos. Asegúrese de enviar el campo "files".' });
    }

    const authReq = req as AuthenticatedRequest;
    const { doctorId, companyId } = req.body;
    let docIdNum = doctorId ? parseInt(doctorId) : null;
    let companyIdVal = companyId ? parseInt(companyId) : null;
    if (authReq.user?.role === 'doctor') {
      docIdNum = authReq.user.doctorId || null;
      const docRes = await db.query('SELECT company_id FROM doctors WHERE id = $1', [authReq.user.doctorId]);
      companyIdVal = docRes.rows[0]?.company_id || null;
    }
    const results: { fileName: string; status: 'success' | 'error'; documentId?: number; error?: string }[] = [];

    console.log(`📦 Procesando lote de ${files.length} archivos para el médico ID: ${docIdNum}, Empresa: ${companyIdVal}`);

    for (const file of files) {
      // Corregir codificación UTF-8 mal interpretada como Latin1 (ISO-8859-1) por multer/busboy
      const fileName = Buffer.from(file.originalname, 'latin1').toString('utf-8');
      const lowerName = fileName.toLowerCase();
      let content = '';

      try {
        if (lowerName.endsWith('.docx')) {
          try {
            const parseResult = await mammoth.extractRawText({ buffer: file.buffer });
            content = parseResult.value.trim();
          } catch (mammothErr: any) {
            try {
              const extractor = new WordExtractor();
              const doc = await extractor.extract(file.buffer);
              content = doc.getBody().trim();
            } catch {
              throw mammothErr;
            }
          }
        } else if (lowerName.endsWith('.pdf')) {
          const pdfData = await (pdf as any)(file.buffer);
          content = pdfData.text.trim();
        } else if (lowerName.endsWith('.txt')) {
          content = file.buffer.toString('utf-8').trim();
        } else if (lowerName.endsWith('.doc')) {
          try {
            const extractor = new WordExtractor();
            const doc = await extractor.extract(file.buffer);
            content = doc.getBody().trim();
          } catch (extractorErr: any) {
            try {
              const parseResult = await mammoth.extractRawText({ buffer: file.buffer });
              content = parseResult.value.trim();
            } catch {
              throw extractorErr;
            }
          }
        } else if (lowerName.endsWith('.rtf')) {
          const { parseRTF, toHTML } = await (Function('return import("@jonahschulte/rtf-toolkit")')() as Promise<any>);
          const parsed = parseRTF(file.buffer.toString('utf-8'));
          const html = toHTML(parsed);
          content = cleanHTML(html);
        } else {
          throw new Error('Formato de archivo no soportado. Use Word (.docx, .doc), RTF (.rtf), PDF (.pdf) o Texto plano (.txt).');
        }

        if (content.length < 10) {
          throw new Error('El contenido extraído es demasiado corto o está vacío.');
        }

        const title = fileName.replace(/\.[^/.]+$/, "");
        const documentId = await ragService.ingestDocument(title, content, docIdNum, companyIdVal);
        
        results.push({
          fileName,
          status: 'success',
          documentId
        });
      } catch (err: any) {
        console.error(`❌ Error procesando archivo "${fileName}" en lote:`, err.message || err);
        results.push({
          fileName,
          status: 'error',
          error: err.message || 'Error desconocido.'
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    res.json({
      message: `Procesamiento en lote completado. Éxitos: ${successCount}, Errores: ${errorCount}`,
      results
    });
  });
});

// ==========================================
// RUTA 1.5: Gestión de Médicos / Perfiles
// ==========================================
app.get('/api/doctors', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    let query = `
      SELECT d.id, d.name, d.specialty, d.style_directives, d.folder_name, d.username, d.company_id as "companyId", c.name as "companyName"
      FROM doctors d
      LEFT JOIN companies c ON d.company_id = c.id
    `;
    const params: any[] = [];
    
    if (authReq.user?.role === 'moderator') {
      query += ' WHERE d.company_id = $1';
      params.push(authReq.user.companyId);
    } else if (authReq.user?.role === 'doctor') {
      query += ' WHERE d.id = $1';
      params.push(authReq.user.doctorId);
    }
    
    query += ' ORDER BY d.name ASC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error al obtener médicos:', error);
    res.status(500).json({ error: error.message || 'Error al obtener médicos.' });
  }
});

// Crear un médico y asociarle plantillas opcionales
app.post('/api/doctors', authenticateAdminOrModerator, async (req: Request, res: Response) => {
  const { name, specialty, style_directives, folder_name, documentIds, username, password, companyId } = req.body;
  if (!name || !specialty || !username || !password) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: name, specialty, username y password.' });
  }
  const pwError = validatePasswordComplexity(password);
  if (pwError) {
    return res.status(400).json({ error: pwError });
  }

  const authReq = req as AuthenticatedRequest;
  let targetCompanyId = companyId;
  if (authReq.user?.role === 'moderator') {
    targetCompanyId = authReq.user.companyId;
  }

  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    
    // Verificar si el username ya está registrado
    const checkUser = await client.query('SELECT id FROM doctors WHERE username = $1', [username.trim()]);
    if (checkUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El nombre de usuario ya está registrado por otro médico.' });
    }

    const pwHash = await hashPassword(password);
    
    const result = await client.query(
      'INSERT INTO doctors (name, specialty, style_directives, folder_name, username, password_hash, company_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, specialty, style_directives, folder_name, username, company_id as "companyId"',
      [name, specialty, style_directives, folder_name || null, username.trim(), pwHash, targetCompanyId ? parseInt(targetCompanyId) : null]
    );
    const newDoctor = result.rows[0];

    // Asociar documentos seleccionados
    if (documentIds && Array.isArray(documentIds) && documentIds.length > 0) {
      await client.query(
        'UPDATE documents SET doctor_id = $1 WHERE id = ANY($2)',
        [newDoctor.id, documentIds.map((id: any) => parseInt(id))]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(newDoctor);
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error al crear médico:', error);
    res.status(500).json({ error: error.message || 'Error al crear médico.' });
  } finally {
    client.release();
  }
});

// Editar un médico y re-asociar plantillas
app.put('/api/doctors/:id', authenticateAdminOrModerator, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, specialty, style_directives, folder_name, documentIds, username, password, companyId } = req.body;
  if (!name || !specialty || !username) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: name, specialty y username.' });
  }

  const authReq = req as AuthenticatedRequest;
  let targetCompanyId = companyId;
  if (authReq.user?.role === 'moderator') {
    targetCompanyId = authReq.user.companyId;
  }

  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    // Si es un moderador, verificar que el médico editado pertenezca a su empresa
    if (authReq.user?.role === 'moderator') {
      const doctorCheck = await client.query('SELECT company_id FROM doctors WHERE id = $1', [parseInt(id)]);
      if (doctorCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Médico no encontrado.' });
      }
      if (doctorCheck.rows[0].company_id !== authReq.user.companyId) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Acceso denegado. No tiene permisos para editar un médico de otra empresa.' });
      }
    }

    // Verificar si el username ya está registrado por otro médico
    const checkUser = await client.query('SELECT id FROM doctors WHERE username = $1 AND id <> $2', [username.trim(), parseInt(id)]);
    if (checkUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El nombre de usuario ya está en uso por otro médico.' });
    }

    let query = 'UPDATE doctors SET name = $1, specialty = $2, style_directives = $3, folder_name = $4, username = $5, company_id = $6';
    const params: any[] = [name, specialty, style_directives, folder_name || null, username.trim(), targetCompanyId ? parseInt(targetCompanyId) : null];

    if (password && password.trim() !== '') {
      const pwComplexError = validatePasswordComplexity(password);
      if (pwComplexError) {
        return res.status(400).json({ error: pwComplexError });
      }
      const pwHash = await hashPassword(password);
      params.push(pwHash);
      query += `, password_hash = $${params.length}`;
    }

    params.push(parseInt(id));
    query += ` WHERE id = $${params.length} RETURNING id, name, specialty, style_directives, folder_name, username, company_id as "companyId"`;

    const result = await client.query(query, params);
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Médico no encontrado.' });
    }
    
    const updatedDoctor = result.rows[0];

    // Desasociar documentos anteriores y asociar los nuevos (solo si se proporcionan en la petición)
    if (documentIds !== undefined) {
      await client.query('UPDATE documents SET doctor_id = NULL WHERE doctor_id = $1', [parseInt(id)]);
      if (Array.isArray(documentIds) && documentIds.length > 0) {
        await client.query(
          'UPDATE documents SET doctor_id = $1 WHERE id = ANY($2)',
          [updatedDoctor.id, documentIds.map((id: any) => parseInt(id))]
        );
      }
    }

    await client.query('COMMIT');
    res.json(updatedDoctor);
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar médico:', error);
    res.status(500).json({ error: error.message || 'Error al actualizar médico.' });
  } finally {
    client.release();
  }
});

// Eliminar un médico
app.delete('/api/doctors/:id', authenticateAdminOrModerator, async (req: Request, res: Response) => {
  const { id } = req.params;
  const authReq = req as AuthenticatedRequest;
  try {
    // Si es un moderador, verificar que el médico pertenezca a su empresa
    if (authReq.user?.role === 'moderator') {
      const doctorCheck = await db.query('SELECT company_id FROM doctors WHERE id = $1', [parseInt(id)]);
      if (doctorCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Médico no encontrado.' });
      }
      if (doctorCheck.rows[0].company_id !== authReq.user.companyId) {
        return res.status(403).json({ error: 'Acceso denegado. No tiene permisos para eliminar un médico de otra empresa.' });
      }
    }

    const result = await db.query('DELETE FROM doctors WHERE id = $1 RETURNING id', [parseInt(id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Médico no encontrado.' });
    }
    res.json({ message: 'Médico eliminado exitosamente.' });
  } catch (error: any) {
    console.error('Error al eliminar médico:', error);
    res.status(500).json({ error: error.message || 'Error al eliminar médico.' });
  }
});

// ==========================================
// RUTA 1.6: Gestión de Empresas (Tenants)
// ==========================================

// Obtener todas las empresas
app.get('/api/companies', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    let query = 'SELECT id, name, logo_base64 as "logoBase64", favicon_base64 as "faviconBase64", color_primary as "colorPrimary", color_secondary as "colorSecondary", color_accent as "colorAccent", created_at as "createdAt" FROM companies';
    const params: any[] = [];

    if (authReq.user?.role === 'moderator') {
      query += ' WHERE id = $1';
      params.push(authReq.user.companyId);
    }

    query += ' ORDER BY name ASC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error al obtener empresas:', error);
    res.status(500).json({ error: error.message || 'Error al obtener empresas.' });
  }
});

// Crear una empresa
app.post('/api/companies', authenticateAdmin, async (req: Request, res: Response) => {
  const { name, logoBase64, faviconBase64, colorPrimary, colorSecondary, colorAccent } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Falta campo obligatorio: name.' });
  }
  try {
    const checkCompany = await db.query('SELECT id FROM companies WHERE name = $1', [name.trim()]);
    if (checkCompany.rows.length > 0) {
      return res.status(400).json({ error: 'Ya existe una empresa con este nombre.' });
    }

    const result = await db.query(
      `INSERT INTO companies (name, logo_base64, favicon_base64, color_primary, color_secondary, color_accent)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, logo_base64 as "logoBase64", favicon_base64 as "faviconBase64", color_primary as "colorPrimary", color_secondary as "colorSecondary", color_accent as "colorAccent"`,
      [
        name.trim(),
        logoBase64 || null,
        faviconBase64 || null,
        colorPrimary || 'oklch(0.12 0.015 195)',
        colorSecondary || 'oklch(0.16 0.018 195)',
        colorAccent || 'oklch(0.70 0.13 185)'
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Error al crear empresa:', error);
    res.status(500).json({ error: error.message || 'Error al crear empresa.' });
  }
});

// Editar una empresa
app.put('/api/companies/:id', authenticateAdminOrModerator, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, logoBase64, faviconBase64, colorPrimary, colorSecondary, colorAccent } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Falta campo obligatorio: name.' });
  }
  const authReq = req as AuthenticatedRequest;
  if (authReq.user?.role === 'moderator' && authReq.user.companyId !== parseInt(id)) {
    return res.status(403).json({ error: 'Acceso denegado. No tiene permisos para modificar otra empresa.' });
  }
  try {
    const checkCompany = await db.query('SELECT id FROM companies WHERE name = $1 AND id <> $2', [name.trim(), parseInt(id)]);
    if (checkCompany.rows.length > 0) {
      return res.status(400).json({ error: 'Ya existe otra empresa con este nombre.' });
    }

    const result = await db.query(
      `UPDATE companies
       SET name = $1, logo_base64 = $2, favicon_base64 = $3, color_primary = $4, color_secondary = $5, color_accent = $6
       WHERE id = $7
       RETURNING id, name, logo_base64 as "logoBase64", favicon_base64 as "faviconBase64", color_primary as "colorPrimary", color_secondary as "colorSecondary", color_accent as "colorAccent"`,
      [
        name.trim(),
        logoBase64 || null,
        faviconBase64 || null,
        colorPrimary || 'oklch(0.12 0.015 195)',
        colorSecondary || 'oklch(0.16 0.018 195)',
        colorAccent || 'oklch(0.70 0.13 185)',
        parseInt(id)
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Empresa no encontrada.' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error al actualizar empresa:', error);
    res.status(500).json({ error: error.message || 'Error al actualizar empresa.' });
  }
});

// Eliminar una empresa
app.delete('/api/companies/:id', authenticateAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM companies WHERE id = $1 RETURNING id', [parseInt(id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Empresa no encontrada.' });
    }
    res.json({ message: 'Empresa eliminada exitosamente.' });
  } catch (error: any) {
    console.error('Error al eliminar empresa:', error);
    res.status(500).json({ error: error.message || 'Error al eliminar empresa.' });
  }
});

// ==========================================
// RUTA 1.7: Gestión de Moderadores (CRUD)
// ==========================================

// Obtener todos los moderadores
app.get('/api/moderators', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const result = await db.query(`
      SELECT m.id, m.name, m.username, m.company_id as "companyId", c.name as "companyName"
      FROM moderators m
      LEFT JOIN companies c ON m.company_id = c.id
      ORDER BY m.name ASC
    `);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error al obtener moderadores:', error);
    res.status(500).json({ error: error.message || 'Error al obtener moderadores.' });
  }
});

// Crear un moderador
app.post('/api/moderators', authenticateAdmin, async (req: Request, res: Response) => {
  const { name, username, password, companyId } = req.body;
  if (!name || !username || !password || !companyId) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: name, username, password y companyId.' });
  }
  const modPwError = validatePasswordComplexity(password);
  if (modPwError) {
    return res.status(400).json({ error: modPwError });
  }
  try {
    const checkUser = await db.query('SELECT id FROM moderators WHERE username = $1', [username.trim()]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: 'El nombre de usuario ya está en uso por otro moderador.' });
    }

    const pwHash = await hashPassword(password);
    const result = await db.query(
      `INSERT INTO moderators (name, username, password_hash, company_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, username, company_id as "companyId"`,
      [name, username.trim(), pwHash, parseInt(companyId)]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Error al crear moderador:', error);
    res.status(500).json({ error: error.message || 'Error al crear moderador.' });
  }
});

// Editar un moderador
app.put('/api/moderators/:id', authenticateAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, username, password, companyId } = req.body;
  if (!name || !username || !companyId) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: name, username y companyId.' });
  }
  try {
    const checkUser = await db.query('SELECT id FROM moderators WHERE username = $1 AND id <> $2', [username.trim(), parseInt(id)]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: 'El nombre de usuario ya está en uso por otro moderador.' });
    }

    let query = 'UPDATE moderators SET name = $1, username = $2, company_id = $3';
    const params: any[] = [name, username.trim(), parseInt(companyId)];

    if (password && password.trim() !== '') {
      const modPwComplexError = validatePasswordComplexity(password);
      if (modPwComplexError) {
        return res.status(400).json({ error: modPwComplexError });
      }
      const pwHash = await hashPassword(password);
      params.push(pwHash);
      query += `, password_hash = $${params.length}`;
    }

    params.push(parseInt(id));
    query += ` WHERE id = $${params.length} RETURNING id, name, username, company_id as "companyId"`;

    const result = await db.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Moderador no encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error al actualizar moderador:', error);
    res.status(500).json({ error: error.message || 'Error al actualizar moderador.' });
  }
});

// Eliminar un moderador
app.delete('/api/moderators/:id', authenticateAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM moderators WHERE id = $1 RETURNING id', [parseInt(id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Moderador no encontrado.' });
    }
    res.json({ message: 'Moderador eliminado exitosamente.' });
  } catch (error: any) {
    console.error('Error al eliminar moderador:', error);
    res.status(500).json({ error: error.message || 'Error al eliminar moderador.' });
  }
});

// ==========================================
// Normalización de puntuación dictada por voz
// ==========================================
/**
 * Convierte palabras de puntuación dictadas por voz ("coma", "punto", "entre paréntesis", etc.)
 * en los signos de puntuación reales, respetando el contexto (decimales, términos médicos).
 */
function normalizeDictatedPunctuation(text: string): string {
  let result = text;

  // 1. "punto aparte" / "punto y aparte" → fin de oración + salto de párrafo
  result = result.replace(/\bpunto\s+y\s+aparte\b/gi, '.\n\n');
  result = result.replace(/\bpunto\s+aparte\b/gi, '.\n\n');

  // 2. "punto y seguido" / "punto seguido" → punto + espacio
  result = result.replace(/\bpunto\s+y\s+seguido\b/gi, '. ');
  result = result.replace(/\bpunto\s+seguido\b/gi, '. ');

  // 3. "punto y coma" → ;
  result = result.replace(/\bpunto\s+y\s+coma\b/gi, '; ');

  // 4. "dos puntos" → :
  result = result.replace(/\bdos\s+puntos\b/gi, ': ');

  // 5. "puntos suspensivos" → ...
  result = result.replace(/\bpuntos\s+suspensivos\b/gi, '...');

  // 6. "punto final" → .
  result = result.replace(/\bpunto\s+final\b/gi, '.');

  // 7. "entre paréntesis" ... "cierra paréntesis" / "cierro paréntesis"
  result = result.replace(/\bentre\s+par[eé]ntesis\b/gi, '(');
  result = result.replace(/\babre\s+par[eé]ntesis\b/gi, '(');
  result = result.replace(/\bcierr[ao]\s+par[eé]ntesis\b/gi, ')');

  // 8. "punto" como separador decimal: "3 punto 5" → "3.5"
  result = result.replace(/(\d)\s+punto\s+(\d)/gi, '$1.$2');

  // 9. "coma" como separador decimal: "6 coma 5" → "6,5"
  result = result.replace(/(\d)\s+coma\s+(\d)/gi, '$1,$2');

  // 10. "punto" suelto (no decimal, no parte de frase compuesta ya resuelta) → .
  // Evitar "punto de" (contexto anatómico, ej: "punto de McBurney")
  result = result.replace(/(?<!\d)\s*\bpunto\b(?!\s+de\b)(?!\s*\d)/gi, '. ');

  // 11. "coma" suelta → , (excluyendo contexto médico: "estado de coma", "coma profundo", "escala de coma")
  result = result.replace(/(?<!de\s)(?<!en\s)(?<!estado\s)(?<!escala\s)(?<!\d)\s*\bcoma\b(?!\s+profund)(?!\s+vigil)(?!\s+inducid)(?!\s+glasgow)(?!\s*\d)/gi, ', ');

  // 12. "signo de exclamación" / "signo de interrogación"
  result = result.replace(/\bsigno\s+de\s+exclamaci[oó]n\b/gi, '!');
  result = result.replace(/\bsigno\s+de\s+interrogaci[oó]n\b/gi, '?');

  // Limpieza: espacios múltiples y espacios antes de puntuación
  result = result.replace(/\s+([.,;:!?)])/g, '$1');
  result = result.replace(/([,(])\s+/g, '$1');
  result = result.replace(/\s{2,}/g, ' ');
  return result;
}

/**
 * Detecta si el texto del dictado solicita cargar una plantilla vacía.
 * Devuelve un booleano y el término de búsqueda de la plantilla.
 */
/**
 * Detecta si el texto del dictado solicita cargar una plantilla vacía.
 * Devuelve un booleano y el término de búsqueda de la plantilla.
 */
function detectTemplateRequest(text: string): { isTemplate: boolean; query: string } {
  const lower = text.toLowerCase().trim();
  const cleanText = lower.replace(/^[.,;:!\s?¿¡]+|[.,;:!\s?¿¡]+$/g, '');
  const wordsList = cleanText.split(/\s+/).filter(w => w.length > 0);
  
  // Verbos de comando de carga en español (deben estar al inicio del dictado para considerarse una orden de carga de plantilla vacía)
  const verbs = [
    'traeme', 'traer', 'dame', 'entrégame', 'entregame', 'cargar', 'carga', 'cargame', 'cárgame',
    'devolver', 'pon', 'muéstrame', 'mostrame', 'poneme', 'buscame', 'buscáme', 'traiga', 'entregue',
    'generar', 'generame', 'generáme'
  ];
  
  // Palabras clave específicas de plantilla
  const templateKeywords = ['plantilla', 'formato', 'modelo', 'esquema'];
  const reportKeywords = ['informe', 'reporte'];

  const startsWithVerb = verbs.some(v => cleanText.startsWith(v));
  const hasTemplateKeyword = templateKeywords.some(tk => cleanText.includes(tk));
  
  let isTemplate = false;
  
  // 1. Si contiene explícitamente "plantilla", "formato", "modelo", "esquema"
  if (hasTemplateKeyword) {
    isTemplate = true;
  }
  // 2. Si empieza explícitamente con un verbo de comando (ej: "traeme...", "dame...")
  else if (startsWithVerb) {
    isTemplate = true;
  }
  
  if (isTemplate) {
    let query = cleanText;
    
    // Quitar verbos iniciales
    for (const v of verbs) {
      if (query.startsWith(v)) {
        query = query.substring(v.length).trim();
        break;
      }
    }
    
    // Quitar artículos y preposiciones comunes iniciales de forma recursiva
    const articles = ['una', 'un', 'la', 'el', 'de', 'para', 'del', 'al', 'con', 'los', 'las'];
    let changed = true;
    while (changed) {
      changed = false;
      const tokens = query.split(/\s+/);
      if (tokens.length > 0 && articles.includes(tokens[0])) {
        query = tokens.slice(1).join(' ').trim();
        changed = true;
      }
    }
    
    // Quitar palabras de plantilla iniciales
    const allKeywords = [...templateKeywords, ...reportKeywords];
    for (const tk of allKeywords) {
      if (query.startsWith(tk)) {
        query = query.substring(tk.length).trim();
        break;
      }
    }
    
    // Limpieza final de artículos por si quedaron tras la palabra clave
    changed = true;
    while (changed) {
      changed = false;
      const tokens = query.split(/\s+/);
      if (tokens.length > 0 && articles.includes(tokens[0])) {
        query = tokens.slice(1).join(' ').trim();
        changed = true;
      }
    }
    
    // Si queda vacío, usar el texto limpio original
    if (query.length < 3) {
      query = cleanText;
    }
    
    return { isTemplate: true, query };
  }
  
  return { isTemplate: false, query: '' };
}

/**
 * Separa una consulta de plantilla compuesta (múltiple) por conectores en español.
 * Si una de las partes resultantes no tiene indicación de la modalidad (ej: "ecografia" o "doppler")
 * pero otra sí la tiene, propaga la modalidad a la parte que carece de ella.
 */
function splitTemplateQuery(query: string): string[] {
  const parts = query.split(/\s+(?:y|e|mas|más|\+)\s+/i).map(p => p.trim()).filter(p => p.length > 0);
  if (parts.length <= 1) return [query];

  const modalityKeywords = ['ecografia', 'ecografía', 'doppler', 'mamografia', 'mamografía', 'punción', 'puncion', 'radiografía', 'radiografia', 'rx'];
  let activeModality = '';
  for (const part of parts) {
    const lowerPart = part.toLowerCase();
    const foundKeyword = modalityKeywords.find(keyword => lowerPart.includes(keyword));
    if (foundKeyword) {
      activeModality = foundKeyword;
      break;
    }
  }

  if (activeModality) {
    return parts.map(part => {
      const lowerPart = part.toLowerCase();
      const hasModality = modalityKeywords.some(keyword => lowerPart.includes(keyword));
      if (!hasModality) {
        return `${activeModality} ${part}`;
      }
      return part;
    });
  }

  return parts;
}

/**
 * Realiza una búsqueda híbrida del documento de plantilla:
 * 1. Búsqueda difusa por coincidencia de palabras del título (tolerando errores de escritura como biopsia vs bopsia).
 * 2. Si no hay coincidencia, búsqueda semántica vectorial (pgvector) sobre los chunks de RAG.
 */
async function findTemplateDocument(query: string, doctorId: number | null, companyId: number | null = null): Promise<{ title: string; content: string; doctor_id: number | null; company_id: number | null } | null> {
  // Auxiliares para similitud de strings (tolerancia a acentos, mayúsculas y pequeños typos)
  function normalizeString(str: string): string {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Quitar acentos y diacríticos
      .replace(/[^a-z0-9]/g, " ")      // Reemplazar no alfanuméricos por espacios
      .trim();
  }

  function getLevenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // sustitución
            matrix[i][j - 1] + 1,     // inserción
            matrix[i - 1][j] + 1      // eliminación
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  function areWordsSimilar(w1: string, w2: string): boolean {
    if (w1 === w2) return true;
    // Si una palabra contiene a la otra y es lo suficientemente larga
    if (w1.length > 3 && w2.length > 3 && (w1.includes(w2) || w2.includes(w1))) return true;
    
    const distance = getLevenshteinDistance(w1, w2);
    const maxLength = Math.max(w1.length, w2.length);
    if (maxLength <= 5) return distance <= 1;
    return distance <= 2;
  }

  // 1. Intentar búsqueda difusa local sobre todos los títulos de plantillas existentes
  try {
    let sql = 'SELECT title, content, doctor_id, company_id FROM documents';
    const params = [];
    const conditions = [];
    if (doctorId !== null) {
      conditions.push(`(doctor_id = $${params.length + 1} OR doctor_id IS NULL)`);
      params.push(doctorId);
    }
    if (companyId !== null) {
      conditions.push(`(company_id = $${params.length + 1} OR company_id IS NULL)`);
      params.push(companyId);
    }
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    const templatesRes = await db.query(sql, params);
    const templates = templatesRes.rows;
    const queryNorm = normalizeString(query);
    const stopwords = ['de', 'para', 'con', 'un', 'una', 'el', 'la', 'del', 'y', 'o', 'en', 'normal', 'vacia', 'vacía', 'vacio', 'vacío', 'plantilla', 'formato', 'modelo', 'todo', 'todos', 'todas', 'traeme', 'dame', 'carga', 'modelo', 'esquema'];
    const queryWords = queryNorm.split(/\s+/).filter(w => w.length > 1 && !stopwords.includes(w));

    if (queryWords.length > 0) {
      let bestMatch: any = null;
      let highestScore = -1;

      for (const t of templates) {
        const titleNorm = normalizeString(t.title);
        const titleWords = titleNorm.split(/\s+/).filter(w => w.length > 1 && !stopwords.includes(w));

        let matchedCount = 0;
        for (const qw of queryWords) {
          const isMatched = titleWords.some(tw => areWordsSimilar(qw, tw));
          if (isMatched) matchedCount++;
        }

        const overlap = matchedCount / queryWords.length;
        
        // Umbral de coincidencia: 100% si es una sola palabra query, al menos 70% si son múltiples palabras
        const minOverlap = queryWords.length === 1 ? 0.99 : 0.7;

        if (overlap >= minOverlap) {
          let score = overlap * 100;
          if (doctorId !== null && t.doctor_id === doctorId) {
            score += 10; // Prioridad al médico actual
          } else if (t.doctor_id === null) {
            score += 5;  // Prioridad secundaria a plantilla general
          }

          if (score > highestScore) {
            highestScore = score;
            bestMatch = t;
          }
        }
      }

      if (bestMatch) {
        console.log(`🎯 Coincidencia difusa de título de plantilla encontrada: "${bestMatch.title}" con score ${highestScore.toFixed(1)}`);
        return {
          title: bestMatch.title,
          content: bestMatch.content,
          doctor_id: bestMatch.doctor_id,
          company_id: bestMatch.company_id
        };
      }
    }
  } catch (err) {
    console.error('Error en búsqueda difusa de títulos de plantilla:', err);
  }

  // 2. Si falla la búsqueda difusa local directa en el título, realizar una búsqueda vectorial semántica
  try {
    const queryEmbedding = await embeddingService.getEmbedding(query);
    const vectorStr = `[${queryEmbedding.join(',')}]`;
    
    let ragSql = `
      SELECT d.title, d.content, d.doctor_id, d.company_id, (dc.embedding <=> $1::vector) as distance
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
    `;
    const ragParams: any[] = [vectorStr];
    const conditions: string[] = [`(dc.embedding <=> $1::vector) < 0.6`];
    
    if (doctorId !== null) {
      conditions.push(`(d.doctor_id = $${conditions.length + 1} OR d.doctor_id IS NULL)`);
      ragParams.push(doctorId);
    }
    if (companyId !== null) {
      conditions.push(`(d.company_id = $${conditions.length + 1} OR d.company_id IS NULL)`);
      ragParams.push(companyId);
    }

    if (conditions.length > 0) {
      ragSql += ` WHERE ` + conditions.join(' AND ');
    }
    
    ragSql += ` ORDER BY distance ASC LIMIT 1`;
    
    const ragResult = await db.query(ragSql, ragParams);
    if (ragResult.rows.length > 0) {
      console.log(`🎯 Coincidencia semántica vectorial de plantilla encontrada: "${ragResult.rows[0].title}" (distancia: ${parseFloat(ragResult.rows[0].distance).toFixed(4)})`);
      return {
        title: ragResult.rows[0].title,
        content: ragResult.rows[0].content,
        doctor_id: ragResult.rows[0].doctor_id,
        company_id: ragResult.rows[0].company_id
      };
    }
  } catch (err) {
    console.error('Error en búsqueda semántica de plantilla:', err);
  }
  
  return null;
}

// ==========================================
// RUTA 2: Estructuración de Dictado (RAG + LLM)
// ==========================================
app.post('/api/reports/structure', authenticate, async (req: Request, res: Response) => {
  const { rawText, doctorId } = req.body;

  if (!rawText || rawText.trim().length === 0) {
    return res.status(400).json({ error: 'El texto del dictado está vacío.' });
  }

  const authReq = req as AuthenticatedRequest;
  let docIdNum = doctorId ? parseInt(doctorId) : null;
  let companyIdVal: number | null = null;

  try {
    if (authReq.user?.role === 'doctor') {
      docIdNum = authReq.user.doctorId || null;
      const docRes = await db.query('SELECT company_id FROM doctors WHERE id = $1', [authReq.user.doctorId]);
      companyIdVal = docRes.rows[0]?.company_id || null;
    }

    // A. Detectar si el usuario solicita cargar una plantilla vacía para editar
    const templateCheck = detectTemplateRequest(rawText);
    if (templateCheck.isTemplate) {
      console.log(`📑 Solicitud de plantilla vacía detectada para: "${templateCheck.query}"`);
      
      const queryParts = splitTemplateQuery(templateCheck.query);
      console.log(`📑 Partes de la consulta detectadas: ${JSON.stringify(queryParts)}`);
      
      const templateDocs: any[] = [];
      for (const part of queryParts) {
        const doc = await findTemplateDocument(part, docIdNum, companyIdVal);
        if (doc) {
          templateDocs.push(doc);
        }
      }

      if (templateDocs.length > 0) {
        // Consultar el modelo de IA activo
        const settingsRes = await db.query("SELECT value FROM system_settings WHERE key = 'active_ai_model'");
        const activeAiModel = settingsRes.rows.length > 0 ? settingsRes.rows[0].value : 'gemma';
        
        // Determinar médico y empresa
        const finalDoctorId = docIdNum || templateDocs[0].doctor_id;
        const finalCompanyId = companyIdVal || templateDocs[0].company_id;
        let doctorProfile: any = null;
        if (finalDoctorId) {
          const docRes = await db.query('SELECT * FROM doctors WHERE id = $1', [finalDoctorId]);
          if (docRes.rows.length > 0) {
            doctorProfile = docRes.rows[0];
          }
        }

        let emptyTemplate = '';
        let reportType = '';

        if (templateDocs.length === 1) {
          console.log(`📑 Una sola plantilla encontrada: "${templateDocs[0].title}". Generando versión editable vacía...`);
          emptyTemplate = await llmService.generateEmptyTemplate(templateDocs[0].title, templateDocs[0].content, doctorProfile, activeAiModel);
          reportType = templateDocs[0].title;
        } else {
          console.log(`📑 Múltiples plantillas encontradas (${templateDocs.length}): ${templateDocs.map(d => `"${d.title}"`).join(', ')}. Fusionando y generando versión vacía...`);
          emptyTemplate = await llmService.generateMergedEmptyTemplate(templateDocs, doctorProfile, activeAiModel);
          reportType = templateDocs.map(d => d.title).join(' y ');
        }

        if (emptyTemplate) {
          const firstLine = emptyTemplate.split('\n')[0].replace(/\*\*/g, '').trim();
          if (firstLine.length > 3 && firstLine.length < 100) {
            reportType = firstLine;
          }
        }

        // Detectar rol del usuario
        let userRole = 'Invitado';
        if (authReq.user) {
          if (authReq.user.role === 'admin') {
            userRole = 'Administrador';
          } else if (authReq.user.role === 'doctor') {
            userRole = 'Médico';
          }
        }

        // Tipo de IA activa
        const aiType = (activeAiModel === 'gemini' || activeAiModel.startsWith('gemini')) ? 'IA en la Nube' : 'IA Local';

        // Guardar el informe resultante en la base de datos
        const result = await db.query(
          'INSERT INTO reports (raw_text, structured_text, doctor_id, report_type, created_by_role, ai_type, company_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at',
          [rawText, emptyTemplate, finalDoctorId, reportType, userRole, aiType, finalCompanyId]
        );

        return res.status(201).json({
          id: result.rows[0].id,
          rawText,
          structuredText: emptyTemplate,
          createdAt: result.rows[0].created_at,
          doctorId: finalDoctorId,
          doctorName: doctorProfile ? doctorProfile.name : null,
          doctorSpecialty: doctorProfile ? doctorProfile.specialty : 'General / Sin médico',
          reportType,
          createdByRole: userRole,
          aiType
        });
      } else {
        console.log(`⚠️ Ninguna plantilla encontrada para la consulta: "${templateCheck.query}"`);
        return res.status(404).json({
          code: 'TEMPLATE_NOT_FOUND',
          query: templateCheck.query,
          error: `No se encontró ninguna plantilla de referencia que coincida con "${templateCheck.query}". Por favor, verifique las plantillas disponibles en el panel de administración.`
        });
      }
    }

    // 1. Recuperar contexto relevante utilizando RAG local (con filtro opcional de médico y empresa)
    console.log(`🔍 Buscando contexto de estudio para: "${rawText.slice(0, 50)}..." (Médico ID: ${docIdNum}, Empresa: ${companyIdVal})`);
    const { context, detectedDoctorId, matchFound } = await ragService.searchContext(rawText, 3, docIdNum, companyIdVal);

    if (!matchFound) {
      console.log(`⚠️ Ninguna plantilla de referencia encontrada para el dictado (Mejor distancia >= 0.5 o sin registros).`);
      return res.status(404).json({
        code: 'TEMPLATE_NOT_FOUND',
        query: rawText.slice(0, 40) + '...',
        error: `No se encontró ninguna plantilla de referencia que coincida con su dictado para el médico solicitado. Por favor, verifique las plantillas disponibles.`
      });
    }

    const finalDoctorId = docIdNum || detectedDoctorId;

    // 2. Obtener perfil del médico si existe
    let doctorProfile: any = null;
    if (finalDoctorId) {
      const docRes = await db.query('SELECT * FROM doctors WHERE id = $1', [finalDoctorId]);
      if (docRes.rows.length > 0) {
        doctorProfile = docRes.rows[0];
        console.log(`🩺 Especialidad/Médico activo: "${doctorProfile.name}" (${doctorProfile.specialty})`);
      }
    } else {
      console.log(`🩺 No se detectó ninguna plantilla de especialidad específica (Perfil General)`);
    }

    // 3. Normalizar puntuación dictada por voz antes de enviar al LLM
    const normalizedText = normalizeDictatedPunctuation(rawText);
    console.log('✏️ Texto normalizado (puntuación dictada → signos):', normalizedText.slice(0, 100) + '...');

    // Consultar el modelo de IA activo
    const settingsRes = await db.query("SELECT value FROM system_settings WHERE key = 'active_ai_model'");
    const activeAiModel = settingsRes.rows.length > 0 ? settingsRes.rows[0].value : 'gemma';

    // 4. Enviar dictado y contexto al LLM (LM Studio / Gemini) con directivas de estilo del médico
    const structuredText = await llmService.structureReport(normalizedText, context, doctorProfile, activeAiModel);

    // Extraer tipo de estudio de la primera línea del reporte
    let reportType = 'Informe';
    if (structuredText) {
      const firstLine = structuredText.split('\n')[0].replace(/\*\*/g, '').trim();
      if (firstLine.length > 3 && firstLine.length < 100) {
        reportType = firstLine;
      }
    }

    // Detectar rol del usuario
    let userRole = 'Invitado';
    if (authReq.user) {
      if (authReq.user.role === 'admin') {
        userRole = 'Administrador';
      } else if (authReq.user.role === 'doctor') {
        userRole = 'Médico';
      }
    }

    // Tipo de IA activa
    const aiType = (activeAiModel === 'gemini' || activeAiModel.startsWith('gemini')) ? 'IA en la Nube' : 'IA Local';

    // 5. Guardar el informe resultante en la base de datos asociando el médico y la empresa
    const result = await db.query(
      'INSERT INTO reports (raw_text, structured_text, doctor_id, report_type, created_by_role, ai_type, company_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at',
      [rawText, structuredText, finalDoctorId, reportType, userRole, aiType, companyIdVal]
    );

    res.status(201).json({
      id: result.rows[0].id,
      rawText,
      structuredText,
      createdAt: result.rows[0].created_at,
      doctorId: detectedDoctorId,
      doctorName: doctorProfile ? doctorProfile.name : null,
      doctorSpecialty: doctorProfile ? doctorProfile.specialty : 'General / Sin médico',
      reportType,
      createdByRole: userRole,
      aiType
    });
  } catch (error: any) {
    console.error('Error en /api/reports/structure:', error);
    res.status(500).json({ error: error.message || 'Error estructurando el informe.' });
  }
});

// ==========================================
// RUTA 3: Corrección Incremental por Voz
// ==========================================
app.post('/api/reports/correct', authenticate, async (req: Request, res: Response) => {
  const { reportId, originalReport, correctionInstruction, doctorId } = req.body;

  if (!originalReport || !correctionInstruction) {
    return res.status(400).json({ error: 'Faltan campos requeridos: originalReport o correctionInstruction.' });
  }

  const authReq = req as AuthenticatedRequest;

  try {
    // 1. Obtener perfil del médico.
    // Si el usuario es médico, forzar el ID de su sesión.
    // Si no se pasó doctorId pero hay reportId, recuperamos el doctor_id persistido del informe
    let docIdNum = doctorId ? parseInt(doctorId) : null;
    if (authReq.user?.role === 'doctor') {
      docIdNum = authReq.user.doctorId || null;
    } else if (!docIdNum && reportId) {
      const repRes = await db.query('SELECT doctor_id FROM reports WHERE id = $1', [parseInt(reportId)]);
      if (repRes.rows.length > 0 && repRes.rows[0].doctor_id) {
        docIdNum = repRes.rows[0].doctor_id;
      }
    }

    let doctorProfile: any = null;
    if (docIdNum) {
      const docRes = await db.query('SELECT * FROM doctors WHERE id = $1', [docIdNum]);
      if (docRes.rows.length > 0) {
        doctorProfile = docRes.rows[0];
      }
    }

    // 2. Normalizar la instrucción de corrección (puntuación)
    const normalizedInstruction = normalizeDictatedPunctuation(correctionInstruction);

    // Consultar el modelo de IA activo
    const settingsRes = await db.query("SELECT value FROM system_settings WHERE key = 'active_ai_model'");
    const activeAiModel = settingsRes.rows.length > 0 ? settingsRes.rows[0].value : 'gemma';

    // 3. Enviar el informe actual y la instrucción de cambio al LLM con el perfil del médico
    // System instruction addition:
    // 8. INTERPRETACIÓN DE PUNTUACIÓN DICTADA: Si en el texto del dictado encuentras palabras residuales como "coma", "punto", "entre paréntesis" que claramente fueron instrucciones de puntuación del médico (no términos médicos), reemplázalas por el signo de puntuación correspondiente. Ejemplos: "placenta anterior coma" → "placenta anterior,"; "abre paréntesis" → "("; "cierra paréntesis" → ")". En caso de duda si "coma" es puntuación o término médico (ej: "estado de coma"), usa el contexto clínico.
    const updatedReport = await llmService.correctReport(originalReport, normalizedInstruction, doctorProfile, activeAiModel);


    // 5. Si se proporciona reportId, actualizar el registro en base de datos
    if (reportId) {
      // Extraer tipo de estudio de la primera línea del reporte corregido
      let reportType = 'Informe';
      if (updatedReport) {
        const firstLine = updatedReport.split('\n')[0].replace(/\*\*/g, '').trim();
        if (firstLine.length > 3 && firstLine.length < 100) {
          reportType = firstLine;
        }
      }

      await db.query(
        'UPDATE reports SET structured_text = $1, doctor_id = $2, report_type = $3 WHERE id = $4',
        [updatedReport, docIdNum, reportType, reportId]
      );
    }

    res.json({
      structuredText: updatedReport,
      doctorId: docIdNum,
      doctorName: doctorProfile ? doctorProfile.name : null,
      doctorSpecialty: doctorProfile ? doctorProfile.specialty : 'General / Sin médico'
    });
  } catch (error: any) {
    console.error('Error en /api/reports/correct:', error);
    res.status(500).json({ error: error.message || 'Error al corregir el informe.' });
  }
});

// Obtener historial de informes (con soporte para búsqueda y filtros)
app.get('/api/reports', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    let countSql = 'SELECT COUNT(r.id) FROM reports r LEFT JOIN doctors d ON r.doctor_id = d.id';
    let dataSql = `
      SELECT r.id, r.raw_text, r.structured_text, r.created_at, 
             r.doctor_id as "doctorId", d.name as "doctorName", d.specialty as "doctorSpecialty",
             r.report_type as "reportType", r.created_by_role as "createdByRole", r.ai_type as "aiType"
      FROM reports r
      LEFT JOIN doctors d ON r.doctor_id = d.id
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    if (req.query.search) {
      const searchVal = (req.query.search as string).trim();
      params.push(searchVal);
      const searchIdx = params.length;
      const isNumeric = /^\d+$/.test(searchVal);
      if (isNumeric) {
        conditions.push(`(r.id = $${searchIdx}::integer OR r.report_type ILIKE '%' || $${searchIdx} || '%')`);
      } else {
        conditions.push(`(r.report_type ILIKE '%' || $${searchIdx} || '%')`);
      }
    }

    // Filtrar por ID de médico (si es un médico, forzar su propio ID. Si es admin, permitir libre elección)
    let targetDoctorId: number | null = null;
    if (authReq.user?.role === 'doctor') {
      targetDoctorId = authReq.user.doctorId || null;
    } else if (req.query.doctorId) {
      const parsedId = parseInt(req.query.doctorId as string);
      if (!isNaN(parsedId)) {
        targetDoctorId = parsedId;
      }
    }

    if (targetDoctorId !== null) {
      params.push(targetDoctorId);
      conditions.push(`r.doctor_id = $${params.length}`);
    }

    // Filtrar por empresa para médicos y moderadores
    if (authReq.user?.role === 'doctor') {
      const docRes = await db.query('SELECT company_id FROM doctors WHERE id = $1', [authReq.user.doctorId]);
      const companyId = docRes.rows[0]?.company_id;
      if (companyId) {
        params.push(companyId);
        conditions.push(`r.company_id = $${params.length}`);
      }
    } else if (authReq.user?.role === 'moderator') {
      const companyId = authReq.user.companyId;
      if (companyId) {
        params.push(companyId);
        conditions.push(`r.company_id = $${params.length}`);
      }
    } else if (authReq.user?.role === 'admin' && req.query.companyId) {
      const parsedCompId = parseInt(req.query.companyId as string);
      if (!isNaN(parsedCompId)) {
        params.push(parsedCompId);
        conditions.push(`r.company_id = $${params.length}`);
      }
    }

    if (req.query.startDate) {
      params.push(req.query.startDate);
      conditions.push(`r.created_at >= $${params.length}::timestamp`);
    }

    if (req.query.endDate) {
      params.push(req.query.endDate);
      conditions.push(`r.created_at <= $${params.length}::timestamp + interval '1 day'`);
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      countSql += whereClause;
      dataSql += whereClause;
    }

    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;

    if (hasPagination) {
      const countResult = await db.query(countSql, params);
      const totalItems = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(totalItems / limit);

      dataSql += ' ORDER BY r.created_at DESC';

      const pageParams = [...params];
      pageParams.push(limit);
      const limitIdx = pageParams.length;
      pageParams.push(offset);
      const offsetIdx = pageParams.length;

      dataSql += ` LIMIT $${limitIdx} OFFSET $${offsetIdx}`;

      const result = await db.query(dataSql, pageParams);

      return res.json({
        reports: result.rows,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages
        }
      });
    } else {
      dataSql += ' ORDER BY r.created_at DESC LIMIT 50';
      const result = await db.query(dataSql, params);
      return res.json(result.rows);
    }
  } catch (error: any) {
    console.error('Error en GET /api/reports:', error);
    res.status(500).json({ error: error.message || 'Error recuperando historial.' });
  }
});

// ==========================================
// RUTA 4: Configuración de Sistema (AI Active Model)
// ==========================================
app.get('/api/settings', async (req: Request, res: Response) => {
  try {
    const result = await db.query("SELECT value FROM system_settings WHERE key = 'active_ai_model'");
    const activeAiModel = result.rows.length > 0 ? result.rows[0].value : 'gemma';
    res.json({ activeAiModel });
  } catch (error: any) {
    console.error('Error al obtener configuración:', error);
    res.status(500).json({ error: error.message || 'Error al obtener configuración.' });
  }
});

app.put('/api/settings', async (req: Request, res: Response) => {
  const { activeAiModel } = req.body;
  if (activeAiModel !== 'gemma' && activeAiModel !== 'gemini' && !activeAiModel.startsWith('gemini-')) {
    return res.status(400).json({ error: 'Modelo de IA inválido. Debe ser "gemma", "gemini" o comenzar con "gemini-".' });
  }
  try {
    await db.query(
      "INSERT INTO system_settings (key, value) VALUES ('active_ai_model', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
      [activeAiModel]
    );
    console.log(`⚙️ Configuración de IA cambiada a: ${activeAiModel}`);
    res.json({ activeAiModel });
  } catch (error: any) {
    console.error('Error al actualizar configuración:', error);
    res.status(500).json({ error: error.message || 'Error al actualizar configuración.' });
  }
});

// ==========================================

// Manejador global de errores (safety net)
// ==========================================
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error('❌ Error no capturado en Express:', err.message || err);
  if (!res.headersSent) {
    res.status(500).json({ error: err.message || 'Error interno del servidor.' });
  }
});

// Inicialización del servidor
async function startServer() {
  // Asegurar conexión exitosa con PostgreSQL
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('❌ Deteniendo inicio del servidor debido a falla de base de datos.');
    process.exit(1);
  }

  // Limpiar/eliminar columna patient_metadata si existiese
  try {
    console.log('🔄 Ejecutando migración para remover la columna patient_metadata...');
    await db.query('ALTER TABLE reports DROP COLUMN IF EXISTS patient_metadata;');
    console.log('✅ Columna patient_metadata eliminada/verificada con éxito.');
  } catch (err: any) {
    console.error('❌ Error eliminando columna patient_metadata:', err.message || err);
    process.exit(1);
  }

  // Verificar y crear tabla system_settings si no existe
  try {
    console.log('🔄 Ejecutando migración para verificar/crear tabla system_settings...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    await db.query(`
      INSERT INTO system_settings (key, value) VALUES ('active_ai_model', 'gemma')
      ON CONFLICT (key) DO NOTHING;
    `);
    console.log('✅ Tabla system_settings verificada/creada con éxito.');
  } catch (err: any) {
    console.error('❌ Error configurando tabla system_settings:', err.message || err);
    process.exit(1);
  }

  // Ejecutar migraciones para agregar columnas de historial
  try {
    console.log('🔄 Ejecutando migración para agregar nuevas columnas a reports...');
    await db.query('ALTER TABLE reports ADD COLUMN IF NOT EXISTS report_type VARCHAR(255);');
    await db.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS created_by_role VARCHAR(100) DEFAULT 'Invitado';");
    await db.query('ALTER TABLE reports ADD COLUMN IF NOT EXISTS ai_type VARCHAR(100);');

    // Rellenar datos nulos de registros anteriores si existen
    await db.query("UPDATE reports SET created_by_role = 'Invitado' WHERE created_by_role IS NULL;");
    await db.query("UPDATE reports SET ai_type = 'IA Local' WHERE ai_type IS NULL;");

    // Rellenar report_type para registros antiguos
    const oldReports = await db.query("SELECT id, structured_text FROM reports WHERE report_type IS NULL;");
    for (const r of oldReports.rows) {
      let type = 'Informe';
      if (r.structured_text) {
        const firstLine = r.structured_text.split('\n')[0].replace(/\*\*/g, '').trim();
        if (firstLine.length > 3 && firstLine.length < 100) {
          type = firstLine;
        }
      }
      await db.query("UPDATE reports SET report_type = $1 WHERE id = $2", [type, r.id]);
    }

    console.log('✅ Columnas de reports migradas con éxito.');
  } catch (err: any) {
    console.error('❌ Error migrando tabla reports:', err.message || err);
    process.exit(1);
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 Servidor backend escuchando en http://0.0.0.0:${PORT}`);
  });
}

startServer();
