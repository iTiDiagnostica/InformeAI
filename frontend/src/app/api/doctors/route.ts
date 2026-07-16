import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/services/dbService';
import { authenticate, authenticateAdminOrModerator, unauthorizedResponse, forbiddenResponse } from '@/utils/auth';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return unauthorizedResponse();

  try {
    let result;
    if (user.role === 'admin') {
      result = await db.query(`
        SELECT d.id, d.name, d.specialty, d.style_directives, d.username, d.company_id, c.name as company_name 
        FROM doctors d 
        LEFT JOIN companies c ON d.company_id = c.id 
        ORDER BY d.id ASC
      `);
    } else if (user.role === 'moderator') {
      result = await db.query(`
        SELECT d.id, d.name, d.specialty, d.style_directives, d.username, d.company_id 
        FROM doctors d 
        WHERE d.company_id = $1 
        ORDER BY d.id ASC
      `, [user.companyId]);
    } else {
      result = await db.query(`
        SELECT id, name, specialty, style_directives, username, company_id 
        FROM doctors WHERE id = $1
      `, [user.doctorId]);
    }
    return NextResponse.json(result.rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = authenticateAdminOrModerator(req);
  if (!user) return forbiddenResponse('Se requiere rol de Administrador o Moderador.');

  try {
    const { name, specialty, style_directives, username, password, company_id } = await req.json();

    if (!name || !username || !password) {
      return NextResponse.json({ error: 'Faltan campos obligatorios (nombre, usuario o contraseÃ±a).' }, { status: 400 });
    }

    let finalCompanyId = company_id;
    if (user.role === 'moderator') {
      finalCompanyId = user.companyId;
    }

    if (!finalCompanyId) {
      return NextResponse.json({ error: 'No se ha asignado empresa.' }, { status: 400 });
    }

    const checkRes = await db.query('SELECT id FROM doctors WHERE username = $1', [username]);
    if (checkRes.rows.length > 0) {
      return NextResponse.json({ error: 'El nombre de usuario ya existe. Elija otro.' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await db.query(
      'INSERT INTO doctors (name, specialty, style_directives, username, password_hash, company_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, specialty, style_directives, username, company_id',
      [name, specialty || 'DiagnÃ³stico por ImÃ¡genes', style_directives || '', username, passwordHash, finalCompanyId]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

