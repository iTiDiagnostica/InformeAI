import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/services/dbService';
import { authenticateAdminOrModerator, forbiddenResponse } from '@/utils/auth';
import bcrypt from 'bcryptjs';

export async function PUT(req: NextRequest, context: any) {
  const user = authenticateAdminOrModerator(req);
  if (!user) return forbiddenResponse();

  try {
    const { name, specialty, style_directives, username, password, company_id } = await req.json();

    if (user.role === 'moderator') {
      const docRes = await db.query('SELECT company_id FROM doctors WHERE id = $1', [(await context.params).id]);
      if (docRes.rows.length === 0 || docRes.rows[0].company_id !== user.companyId) {
        return forbiddenResponse('No puede editar un médico que no pertenece a su empresa.');
      }
    }

    if (username) {
      const checkRes = await db.query('SELECT id FROM doctors WHERE username = $1 AND id != $2', [username, (await context.params).id]);
      if (checkRes.rows.length > 0) {
        return NextResponse.json({ error: 'El nombre de usuario ya está en uso por otro médico.' }, { status: 400 });
      }
    }

    let queryStr = 'UPDATE doctors SET name = $1, specialty = $2, style_directives = $3, username = $4';
    const queryParams: any[] = [name, specialty, style_directives, username];
    let paramIndex = 5;

    if (password && password.trim() !== '') {
      const passwordHash = await bcrypt.hash(password, 12);
      queryStr += `, password_hash = $${paramIndex}`;
      queryParams.push(passwordHash);
      paramIndex++;
    }

    if (user.role === 'admin' && company_id) {
      queryStr += `, company_id = $${paramIndex}`;
      queryParams.push(company_id);
      paramIndex++;
    }

    queryStr += ` WHERE id = $${paramIndex} RETURNING id, name, specialty, style_directives, username, company_id`;
    queryParams.push((await context.params).id);

    const result = await db.query(queryStr, queryParams);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Médico no encontrado.' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: any) {
  const user = authenticateAdminOrModerator(req);
  if (!user) return forbiddenResponse();

  try {
    if (user.role === 'moderator') {
      const docRes = await db.query('SELECT company_id FROM doctors WHERE id = $1', [(await context.params).id]);
      if (docRes.rows.length === 0 || docRes.rows[0].company_id !== user.companyId) {
        return forbiddenResponse('No puede eliminar un médico que no pertenece a su empresa.');
      }
    }

    await db.query('DELETE FROM doctors WHERE id = $1', [(await context.params).id]);
    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
