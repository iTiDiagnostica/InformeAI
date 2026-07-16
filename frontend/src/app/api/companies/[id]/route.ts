import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/services/dbService';
import { authenticateAdmin, forbiddenResponse } from '@/utils/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = authenticateAdmin(req);
  if (!user) return forbiddenResponse();

  try {
    const { name, color_primary, color_secondary, color_accent, logo_base64, favicon_base64 } = await req.json();
    const result = await db.query(
      'UPDATE companies SET name = $1, color_primary = $2, color_secondary = $3, color_accent = $4, logo_base64 = $5, favicon_base64 = $6 WHERE id = $7 RETURNING *',
      [name, color_primary, color_secondary, color_accent, logo_base64, favicon_base64, params.id]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: 'Empresa no encontrada.' }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = authenticateAdmin(req);
  if (!user) return forbiddenResponse();

  try {
    await db.query('DELETE FROM companies WHERE id = $1', [params.id]);
    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
