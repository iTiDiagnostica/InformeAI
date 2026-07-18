import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/services/dbService';
import { ragService } from '@/services/ragService';
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

    const mappedDoc = {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      doctorId: doc.doctor_id ?? null,
      companyId: doc.company_id ?? null,
      created_at: doc.created_at,
    };
    return NextResponse.json(mappedDoc);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: any) {
  const user = authenticate(req);
  if (!user) return unauthorizedResponse();

  try {
    const body = await req.json();
    const { title, content } = body;
    const doctorId = body.doctorId ?? body.doctor_id;
    const id = parseInt((await context.params).id, 10);

    if (!title || !content) {
      return NextResponse.json({ error: 'Faltan campos (title, content).' }, { status: 400 });
    }

    const docRes = await db.query('SELECT doctor_id, company_id FROM documents WHERE id = $1', [id]);
    if (docRes.rows.length === 0) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }
    const doc = docRes.rows[0];

    if (user.role === 'moderator') {
      if (doc.company_id && doc.company_id !== user.companyId) {
        return forbiddenResponse('No puede editar un documento que no pertenece a su empresa.');
      }
    } else if (user.role === 'doctor') {
      if (doc.doctor_id !== user.doctorId) {
        return forbiddenResponse('Solo puede editar sus propios documentos privados.');
      }
    }

    let targetDoctorId: number | null = doctorId ? parseInt(doctorId, 10) : null;
    let targetCompanyId: number | null = doc.company_id;

    if (user.role === 'doctor') {
      targetDoctorId = user.doctorId;
    } else if (user.role === 'moderator') {
      if (targetDoctorId) {
        const checkDoc = await db.query('SELECT company_id FROM doctors WHERE id = $1', [targetDoctorId]);
        if (checkDoc.rows.length === 0 || checkDoc.rows[0].company_id !== user.companyId) {
          return forbiddenResponse('No puede asignar plantillas a un médico que no pertenece a su empresa.');
        }
      }
    } else if (user.role === 'admin') {
      if (targetDoctorId) {
        const checkDoc = await db.query('SELECT company_id FROM doctors WHERE id = $1', [targetDoctorId]);
        targetCompanyId = checkDoc.rows.length > 0 ? checkDoc.rows[0].company_id : null;
      }
    }

    await ragService.updateDocument(id, title, content, targetDoctorId, targetCompanyId);

    return NextResponse.json({ message: 'Documento actualizado exitosamente' });
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
