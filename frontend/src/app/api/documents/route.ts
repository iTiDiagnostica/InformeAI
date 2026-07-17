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
        SELECT d.id, d.title, d.doctor_id, d.company_id, d.created_at, doc.name as "doctorName", c.name as company_name
        FROM documents d
        LEFT JOIN doctors doc ON d.doctor_id = doc.id
        LEFT JOIN companies c ON d.company_id = c.id
        ORDER BY d.id DESC
      `);
    } else if (user.role === 'moderator') {
      result = await db.query(`
        SELECT d.id, d.title, d.doctor_id, d.company_id, d.created_at, doc.name as "doctorName"
        FROM documents d
        LEFT JOIN doctors doc ON d.doctor_id = doc.id
        WHERE d.company_id = $1 OR d.company_id IS NULL
        ORDER BY d.id DESC
      `, [user.companyId]);
    } else {
      const docRes = await db.query('SELECT company_id FROM doctors WHERE id = $1', [user.doctorId]);
      const companyId = docRes.rows.length > 0 ? docRes.rows[0].company_id : null;
      
      result = await db.query(`
        SELECT d.id, d.title, d.doctor_id, d.company_id, d.created_at, doc.name as "doctorName"
        FROM documents d
        LEFT JOIN doctors doc ON d.doctor_id = doc.id
        WHERE d.doctor_id = $1 OR (d.company_id = $2 AND d.doctor_id IS NULL) OR (d.doctor_id IS NULL AND d.company_id IS NULL)
        ORDER BY d.id DESC
      `, [user.doctorId, companyId]);
    }
    // Mapear snake_case de PostgreSQL a camelCase para el frontend
    const mapped = result.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      doctorId: row.doctor_id ?? null,
      companyId: row.company_id ?? null,
      created_at: row.created_at,
      doctorName: row.doctorName ?? null,
      companyName: row.company_name ?? null,
      length: row.length ?? 0,
    }));
    return NextResponse.json(mapped);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

