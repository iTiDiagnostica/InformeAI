import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/services/dbService';
import { authenticate, authenticateAdmin, unauthorizedResponse, forbiddenResponse } from '@/utils/auth';

export async function GET(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return unauthorizedResponse();

  try {
    let result;
    if (user.role === 'admin') {
      result = await db.query('SELECT * FROM companies ORDER BY id ASC');
    } else if (user.role === 'moderator') {
      result = await db.query('SELECT * FROM companies WHERE id = $1', [user.companyId]);
    } else {
      const docRes = await db.query('SELECT company_id FROM doctors WHERE id = $1', [user.doctorId]);
      if (docRes.rows.length === 0 || !docRes.rows[0].company_id) {
        return NextResponse.json([]);
      }
      result = await db.query('SELECT * FROM companies WHERE id = $1', [docRes.rows[0].company_id]);
    }
    return NextResponse.json(result.rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = authenticateAdmin(req);
  if (!user) return forbiddenResponse('Se requiere rol de Administrador.');

  try {
    const { name, color_primary, color_secondary, color_accent, logo_base64, favicon_base64 } = await req.json();
    if (!name) return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 });

    const result = await db.query(
      'INSERT INTO companies (name, color_primary, color_secondary, color_accent, logo_base64, favicon_base64) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, color_primary || 'oklch(0.12 0.015 195)', color_secondary || 'oklch(0.16 0.018 195)', color_accent || 'oklch(0.70 0.13 185)', logo_base64 || null, favicon_base64 || null]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
