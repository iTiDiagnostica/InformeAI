import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/services/dbService';
import { ragService } from '@/services/ragService';
import { authenticate, unauthorizedResponse, forbiddenResponse } from '@/utils/auth';

export async function POST(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return unauthorizedResponse();

  try {
    const { title, content, doctorId } = await req.json();

    if (!title || !content) {
      return NextResponse.json({ error: 'Faltan campos (title, content).' }, { status: 400 });
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

    const documentId = await ragService.ingestDocument(title, content, targetDoctorId, targetCompanyId);

    return NextResponse.json({ message: 'Documento ingerido exitosamente', documentId }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

