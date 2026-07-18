import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/services/dbService';
import { authenticateAdmin, forbiddenResponse } from '@/utils/auth';
import bcrypt from 'bcryptjs';

export async function PUT(req: NextRequest, context: any) {
  const user = authenticateAdmin(req);
  if (!user) return forbiddenResponse();

  try {
    const body = await req.json();
    const { name, username, password } = body;
    const company_id = body.company_id ?? body.companyId;

    if (username) {
      const checkRes = await db.query('SELECT id FROM moderators WHERE username = $1 AND id != $2', [username, (await context.params).id]);
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

    if (company_id !== undefined) {
      queryStr += `, company_id = $${paramIndex}`;
      queryParams.push(company_id);
      paramIndex++;
    }

    queryStr += ` WHERE id = $${paramIndex} RETURNING id, name, username, company_id as "companyId"`;
    queryParams.push((await context.params).id);

    const result = await db.query(queryStr, queryParams);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Moderador no encontrado.' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: any) {
  const user = authenticateAdmin(req);
  if (!user) return forbiddenResponse();

  try {
    await db.query('DELETE FROM moderators WHERE id = $1', [(await context.params).id]);
    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
