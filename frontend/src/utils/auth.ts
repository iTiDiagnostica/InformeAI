import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

let SECRET = process.env.JWT_SECRET || '';

function getSecret(): string {
  if (!SECRET) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ ERROR CRÍTICO: JWT_SECRET no está configurado en producción. Las firmas no son seguras.');
      throw new Error('JWT_SECRET debe estar configurado en producción.');
    } else {
      console.warn('⚠️ ADVERTENCIA: JWT_SECRET no está configurado en desarrollo. Usando firma por defecto para depuración.');
      SECRET = 'dev_supersecret_default_key_change_me';
    }
  }
  return SECRET;
}

export function generateDoctorToken(doctorId: number): string {
  const signature = crypto.createHmac('sha256', getSecret()).update(doctorId.toString()).digest('hex');
  return `doctor-${doctorId}-${signature}`;
}

export function verifyDoctorToken(token: string): number | null {
  if (!token.startsWith('doctor-')) return null;
  const parts = token.split('-');
  if (parts.length !== 3) return null;
  const doctorIdStr = parts[1];
  const signature = parts[2];
  const expectedSignature = crypto.createHmac('sha256', getSecret()).update(doctorIdStr).digest('hex');
  if (signature !== expectedSignature) return null;
  return parseInt(doctorIdStr, 10);
}

export function generateModeratorToken(moderatorId: number, companyId: number): string {
  const payload = `${moderatorId}-${companyId}`;
  const signature = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  return `moderator-${payload}-${signature}`;
}

export function verifyModeratorToken(token: string): { moderatorId: number; companyId: number } | null {
  if (!token.startsWith('moderator-')) return null;
  const parts = token.split('-');
  if (parts.length !== 4) return null;
  const moderatorIdStr = parts[1];
  const companyIdStr = parts[2];
  const signature = parts[3];
  const expectedSignature = crypto.createHmac('sha256', getSecret()).update(`${moderatorIdStr}-${companyIdStr}`).digest('hex');
  if (signature !== expectedSignature) return null;
  return { moderatorId: parseInt(moderatorIdStr, 10), companyId: parseInt(companyIdStr, 10) };
}

export type AuthUser = 
  | { role: 'admin' }
  | { role: 'doctor'; doctorId: number }
  | { role: 'moderator'; moderatorId: number; companyId: number };

export function authenticate(req: NextRequest): AuthUser | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  const expectedAdminToken = process.env.ADMIN_TOKEN || '';

  if (token === expectedAdminToken) {
    return { role: 'admin' };
  }

  const doctorId = verifyDoctorToken(token);
  if (doctorId !== null) {
    return { role: 'doctor', doctorId };
  }

  const modData = verifyModeratorToken(token);
  if (modData !== null) {
    return { role: 'moderator', moderatorId: modData.moderatorId, companyId: modData.companyId };
  }

  return null;
}

export function authenticateAdmin(req: NextRequest): AuthUser | null {
  const user = authenticate(req);
  if (user && user.role === 'admin') return user;
  return null;
}

export function authenticateAdminOrModerator(req: NextRequest): AuthUser | null {
  const user = authenticate(req);
  if (user && (user.role === 'admin' || user.role === 'moderator')) return user;
  return null;
}

export function unauthorizedResponse(message: string = 'Acceso denegado') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbiddenResponse(message: string = 'Acceso denegado. Permisos insuficientes.') {
  return NextResponse.json({ error: message }, { status: 403 });
}
