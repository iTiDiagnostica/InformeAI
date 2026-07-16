import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/services/dbService';
import { authenticate, unauthorizedResponse, forbiddenResponse } from '@/utils/auth';

export async function GET(req: NextRequest, context: any) {
  const user = authenticate(req);
  if (!user) return unauthorizedResponse();

  try {
    const result = await db.query('SELECT * FROM documents WHERE id = $1', [(await context.params).id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }
    const doc = result.rows[0];

    if (user.role === 'moderator') {
      if (doc.company_id && doc.company_id !== user.companyId) {
        return forbiddenResponse('No puede ver un documento que no pertenece a su empresa.');
      }
    } else if (user.role === 'doctor') {
      const docRes = await db.query('SELECT company_id FROM doctors WHERE id = $1', [user.doctorId]);
      const companyId = docRes.rows.length > 0 ? docRes.rows[0].company_id : null;
      if (doc.doctor_id && doc.doctor_id !== user.doctorId) {
        return forbiddenResponse('No puede ver documentos privados de otros médicos.');
      }
      if (!doc.doctor_id && doc.company_id && doc.company_id !== companyId) {
        return forbiddenResponse('No puede ver documentos de otra empresa.');
      }
    }

    return NextResponse.json(doc);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: any) {
  const user = authenticate(req);
  if (!user) return unauthorizedResponse();

  try {
    const checkRes = await db.query('SELECT doctor_id, company_id FROM documents WHERE id = $1', [(await context.params).id]);
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }
    const doc = checkRes.rows[0];

    if (user.role === 'moderator') {
      if (doc.company_id && doc.company_id !== user.companyId) {
        return forbiddenResponse('No puede eliminar un documento que no pertenece a su empresa.');
      }
    } else if (user.role === 'doctor') {
      if (doc.doctor_id !== user.doctorId) {
        return forbiddenResponse('Solo puede eliminar sus propios documentos privados.');
      }
    }

    await db.query('DELETE FROM documents WHERE id = $1', [(await context.params).id]);
    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
