import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/services/dbService';
import { authenticateAdmin, forbiddenResponse } from '@/utils/auth';

export async function PUT(req: NextRequest, context: any) {
  const user = authenticateAdmin(req);
  if (!user) return forbiddenResponse();

  try {
    const body = await req.json();
    const name = body.name;
    const color_primary = body.color_primary ?? body.colorPrimary;
    const color_secondary = body.color_secondary ?? body.colorSecondary;
    const color_accent = body.color_accent ?? body.colorAccent;
    const logo_base64 = body.logo_base64 ?? body.logoBase64;
    const favicon_base64 = body.favicon_base64 ?? body.faviconBase64;

    const result = await db.query(
      'UPDATE companies SET name = $1, color_primary = $2, color_secondary = $3, color_accent = $4, logo_base64 = $5, favicon_base64 = $6 WHERE id = $7 RETURNING id, name, logo_base64 as "logoBase64", favicon_base64 as "faviconBase64", color_primary as "colorPrimary", color_secondary as "colorSecondary", color_accent as "colorAccent", created_at',
      [name, color_primary, color_secondary, color_accent, logo_base64, favicon_base64, (await context.params).id]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: 'Empresa no encontrada.' }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: any) {
  const user = authenticateAdmin(req);
  if (!user) return forbiddenResponse();

  try {
    await db.query('DELETE FROM companies WHERE id = $1', [(await context.params).id]);
    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
