import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/services/dbService';
import { ragService } from '@/services/ragService';
import { authenticate, unauthorizedResponse } from '@/utils/auth';

export async function POST(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return unauthorizedResponse();

  try {
    const { reportId, rating, isExemplar, feedbackTag, userComment } = await req.json();

    if (!reportId || rating === undefined) {
      return NextResponse.json({ error: 'Faltan parámetros obligatorios (reportId, rating).' }, { status: 400 });
    }

    let doctorId = user.role === 'doctor' ? user.doctorId : null;
    if (!doctorId) {
      const repRes = await db.query('SELECT doctor_id FROM reports WHERE id = $1', [reportId]);
      doctorId = repRes.rows[0]?.doctor_id || null;
    }

    if (!doctorId) {
      return NextResponse.json({ error: 'No se encontró un médico asociado al informe para registrar el ejemplo.' }, { status: 400 });
    }

    // 1. Registrar o actualizar la evaluación en report_feedback
    await db.query(
      `INSERT INTO report_feedback (report_id, doctor_id, rating, feedback_tag, user_comment)
       VALUES ($1, $2, $3, $4, $5)`,
      [reportId, doctorId, rating, feedbackTag || null, userComment || null]
    );

    // 2. Actualizar la calificación en la tabla principal de informes
    if (isExemplar && rating === 1) {
      await ragService.saveDoctorExemplar(reportId, doctorId);
    } else {
      await db.query(
        `UPDATE reports SET rating = $1, is_exemplar = FALSE, exemplar_embedding = NULL WHERE id = $2 AND doctor_id = $3`,
        [rating, reportId, doctorId]
      );
    }

    return NextResponse.json({
      success: true,
      rating,
      isExemplar: rating === 1 && !!isExemplar,
      message: rating === 1 ? 'Informe guardado como ejemplo modélico exitosamente.' : rating === -1 ? 'Calificación registrada como inadecuado.' : 'Calificación removida.'
    });
  } catch (error: any) {
    console.error('Error procesando feedback del informe:', error);
    return NextResponse.json({ error: error.message || 'Error registrando feedback.' }, { status: 500 });
  }
}
