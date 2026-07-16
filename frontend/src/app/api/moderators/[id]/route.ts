import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/services/dbService';
import { authenticateAdmin, forbiddenResponse } from '@/utils/auth';
import bcrypt from 'bcryptjs';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = authenticateAdmin(req);
  if (!user) return forbiddenResponse();

  try {
    const { name, username, password, company_id } = await req.json();

    if (username) {
      const checkRes = await db.query('SELECT id FROM moderators WHERE username = $1 AND id != $2', [username, params.id]);
      if (checkRes.rows.length > 0) {
        return NextResponse.json({ error: 'El nombre de usuario ya está en uso por otro moderador.' }, { status: 400 });
      }
    }

    let queryStr = 'UPDATE moderators SET name = $1, username = $2';
    const queryParams: any[] = [name, username];
    let paramIndex = 3;

    if (password && password.trim() !== '') {
      const passwordHash = await bcrypt.hash(password, 12);
      queryStr += `, password_hash = $${paramIndex}`;
      queryParams.push(passwordHash);
      paramIndex++;
    }

    if (company_id) {
      queryStr += `, company_id = $${paramIndex}`;
      queryParams.push(company_id);
      paramIndex++;
    }

    queryStr += ` WHERE id = $${paramIndex} RETURNING id, name, username, company_id`;
    queryParams.push(params.id);

    const result = await db.query(queryStr, queryParams);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Moderador no encontrado.' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = authenticateAdmin(req);
  if (!user) return forbiddenResponse();

  try {
    await db.query('DELETE FROM moderators WHERE id = $1', [params.id]);
    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
