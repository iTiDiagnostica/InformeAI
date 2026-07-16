import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/services/dbService';
import { authenticate, unauthorizedResponse } from '@/utils/auth';

export async function GET(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return unauthorizedResponse();

  try {
    let result;
    if (user.role === 'admin') {
      result = await db.query(`
        SELECT d.id, d.title, d.doctor_id, d.company_id, d.created_at, doc.name as doctor_name, c.name as company_name
        FROM documents d
        LEFT JOIN doctors doc ON d.doctor_id = doc.id
        LEFT JOIN companies c ON d.company_id = c.id
        ORDER BY d.id DESC
      `);
    } else if (user.role === 'moderator') {
      result = await db.query(`
        SELECT d.id, d.title, d.doctor_id, d.company_id, d.created_at, doc.name as doctor_name
        FROM documents d
        LEFT JOIN doctors doc ON d.doctor_id = doc.id
        WHERE d.company_id = $1 OR d.company_id IS NULL
        ORDER BY d.id DESC
      `, [user.companyId]);
    } else {
      const docRes = await db.query('SELECT company_id FROM doctors WHERE id = $1', [user.doctorId]);
      const companyId = docRes.rows.length > 0 ? docRes.rows[0].company_id : null;
      
      result = await db.query(`
        SELECT id, title, doctor_id, company_id, created_at 
        FROM documents 
        WHERE doctor_id = $1 OR (company_id = $2 AND doctor_id IS NULL) OR (doctor_id IS NULL AND company_id IS NULL)
        ORDER BY id DESC
      `, [user.doctorId, companyId]);
    }
    return NextResponse.json(result.rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

