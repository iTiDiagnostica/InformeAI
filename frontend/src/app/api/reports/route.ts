import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/services/dbService';
import { authenticate, unauthorizedResponse } from '@/utils/auth';

export async function GET(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return unauthorizedResponse();

  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    const doctorId = url.searchParams.get('doctorId');
    const companyId = url.searchParams.get('companyId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    const offset = (page - 1) * limit;

    let conditions: string[] = [];
    let queryParams: any[] = [];
    let paramIndex = 1;

    if (user.role === 'admin') {
      if (companyId) {
        conditions.push(`r.company_id = $${paramIndex}`);
        queryParams.push(companyId);
        paramIndex++;
      }
    } else if (user.role === 'moderator') {
      conditions.push(`r.company_id = $${paramIndex}`);
      queryParams.push(user.companyId);
      paramIndex++;
    } else {
      conditions.push(`r.doctor_id = $${paramIndex}`);
      queryParams.push(user.doctorId);
      paramIndex++;
    }

    if (doctorId && user.role !== 'doctor') {
      conditions.push(`r.doctor_id = $${paramIndex}`);
      queryParams.push(doctorId);
      paramIndex++;
    }

    if (startDate) {
      conditions.push(`r.created_at >= $${paramIndex}`);
      queryParams.push(`${startDate} 00:00:00`);
      paramIndex++;
    }
    if (endDate) {
      conditions.push(`r.created_at <= $${paramIndex}`);
      queryParams.push(`${endDate} 23:59:59`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM reports r ${whereClause}`;
    const countRes = await db.query(countQuery, queryParams);
    const totalItems = parseInt(countRes.rows[0].count, 10);
    const totalPages = Math.ceil(totalItems / limit);

    const dataQuery = `
      SELECT r.id, r.raw_text, r.structured_text, r.created_at, 
             r.doctor_id as "doctorId", d.name as "doctorName", d.specialty as "doctorSpecialty",
             r.report_type as "reportType", r.created_by_role as "createdByRole", r.ai_type as "aiType",
             r.company_id as "companyId", c.name as "companyName"
      FROM reports r 
      LEFT JOIN doctors d ON r.doctor_id = d.id 
      LEFT JOIN companies c ON r.company_id = c.id 
      ${whereClause} 
      ORDER BY r.created_at DESC 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    queryParams.push(limit, offset);

    const dataRes = await db.query(dataQuery, queryParams);

    return NextResponse.json({
      reports: dataRes.rows,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        limit
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

