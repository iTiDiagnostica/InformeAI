import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/services/dbService';
import { ragService } from '@/services/ragService';
import { authenticate, unauthorizedResponse, forbiddenResponse } from '@/utils/auth';

export async function POST(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return unauthorizedResponse();

  try {
    const { documents, doctorId } = await req.json();

    if (!Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json({ error: 'Debe enviar un arreglo de documentos.' }, { status: 400 });
    }

    let targetDoctorId: number | null = null;
    let targetCompanyId: number | null = null;

    if (user.role === 'doctor') {
      targetDoctorId = user.doctorId;
      const docRes = await db.query('SELECT company_id FROM doctors WHERE id = $1', [user.doctorId]);
      targetCompanyId = docRes.rows.length > 0 ? docRes.rows[0].company_id : null;
    } else if (user.role === 'moderator') {
      targetCompanyId = user.companyId;
      if (doctorId) {
        const docRes = await db.query('SELECT company_id FROM doctors WHERE id = $1', [doctorId]);
        if (docRes.rows.length === 0 || docRes.rows[0].company_id !== user.companyId) {
          return forbiddenResponse('No puede asignar plantillas a un mÃ©dico que no pertenece a su empresa.');
        }
        targetDoctorId = parseInt(doctorId, 10);
      }
    } else if (user.role === 'admin') {
      if (doctorId) {
        targetDoctorId = parseInt(doctorId, 10);
        const docRes = await db.query('SELECT company_id FROM doctors WHERE id = $1', [doctorId]);
        targetCompanyId = docRes.rows.length > 0 ? docRes.rows[0].company_id : null;
      }
    }

    const results = [];
    const errors = [];

    for (const doc of documents) {
      if (!doc.title || !doc.content) {
        errors.push({ title: doc.title, error: 'Faltan campos' });
        continue;
      }
      try {
        const docId = await ragService.ingestDocument(doc.title, doc.content, targetDoctorId, targetCompanyId);
        results.push({ title: doc.title, id: docId });
      } catch (err: any) {
        errors.push({ title: doc.title, error: err.message });
      }
    }

    return NextResponse.json({ 
      message: 'Proceso de importaciÃ³n finalizado',
      success: results,
      errors: errors
    }, { status: 207 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

