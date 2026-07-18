import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/services/dbService';
import { authenticateAdmin, forbiddenResponse } from '@/utils/auth';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
  const user = authenticateAdmin(req);
  if (!user) return forbiddenResponse();

  try {
    const result = await db.query(`
      SELECT m.id, m.name, m.username, m.company_id as "companyId", c.name as "companyName" 
      FROM moderators m 
      LEFT JOIN companies c ON m.company_id = c.id 
      ORDER BY m.id ASC
    `);
    return NextResponse.json(result.rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = authenticateAdmin(req);
  if (!user) return forbiddenResponse();

  try {
    const body = await req.json();
    const { name, username, password } = body;
    const company_id = body.company_id ?? body.companyId;

    if (!name || !username || !password || !company_id) {
      return NextResponse.json({ error: 'Faltan campos obligatorios.' }, { status: 400 });
    }

    const checkRes = await db.query('SELECT id FROM moderators WHERE username = $1', [username]);
    if (checkRes.rows.length > 0) {
      return NextResponse.json({ error: 'El nombre de usuario ya existe. Elija otro.' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await db.query(
      'INSERT INTO moderators (name, username, password_hash, company_id) VALUES ($1, $2, $3, $4) RETURNING id, name, username, company_id as "companyId"',
      [name, username, passwordHash, company_id]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

