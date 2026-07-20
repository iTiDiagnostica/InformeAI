import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/services/dbService';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Por favor, ingrese usuario y contraseña.' }, { status: 400 });
    }

    const expectedAdminUsername = process.env.ADMIN_USERNAME!;
    const expectedAdminPassword = process.env.ADMIN_PASSWORD!;
    const adminToken = process.env.ADMIN_TOKEN!;

    if (username === expectedAdminUsername && password === expectedAdminPassword) {
      return NextResponse.json({ token: adminToken, role: 'admin' });
    }

    const modRes = await db.query('SELECT * FROM moderators WHERE username = $1', [username]);
    if (modRes.rows.length > 0) {
      const moderator = modRes.rows[0];
      let isMatch = false;
      if (moderator.password_hash.startsWith('$2a$') || moderator.password_hash.startsWith('$2b$')) {
        isMatch = await bcrypt.compare(password, moderator.password_hash);
      } else {
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256').update(password).digest('hex');
        isMatch = (hash === moderator.password_hash);
      }
      
      if (isMatch) {
        const { generateModeratorToken } = await import('@/utils/auth');
        const token = generateModeratorToken(moderator.id, moderator.company_id);
        
        let companyTheme = null;
        if (moderator.company_id) {
          const compRes = await db.query('SELECT * FROM companies WHERE id = $1', [moderator.company_id]);
          if (compRes.rows.length > 0) {
            const comp = compRes.rows[0];
            companyTheme = {
              id: comp.id,
              name: comp.name,
              logo: comp.logo_base64 || null,
              favicon: comp.favicon_base64 || null,
              primary: comp.color_primary,
              secondary: comp.color_secondary,
              accent: comp.color_accent
            };
          }
        }
        
        return NextResponse.json({ 
          token, 
          role: 'moderator', 
          moderatorId: moderator.id, 
          companyId: moderator.company_id,
          companyTheme 
        });
      }
    }

    const docRes = await db.query('SELECT * FROM doctors WHERE username = $1', [username]);
    if (docRes.rows.length > 0) {
      const doctor = docRes.rows[0];
      let isMatch = false;
      if (doctor.password_hash) {
        if (doctor.password_hash.startsWith('$2a$') || doctor.password_hash.startsWith('$2b$')) {
          isMatch = await bcrypt.compare(password, doctor.password_hash);
        } else {
          const crypto = require('crypto');
          const hash = crypto.createHash('sha256').update(password).digest('hex');
          isMatch = (hash === doctor.password_hash);
        }
      }
      if (isMatch) {
        const { generateDoctorToken } = await import('@/utils/auth');
        const token = generateDoctorToken(doctor.id);
        
        let companyTheme = null;
        if (doctor.company_id) {
          const compRes = await db.query('SELECT * FROM companies WHERE id = $1', [doctor.company_id]);
          if (compRes.rows.length > 0) {
            const comp = compRes.rows[0];
            companyTheme = {
              id: comp.id,
              name: comp.name,
              logo: comp.logo_base64 || null,
              favicon: comp.favicon_base64 || null,
              primary: comp.color_primary,
              secondary: comp.color_secondary,
              accent: comp.color_accent
            };
          }
        }
        
        return NextResponse.json({ 
          token, 
          role: 'doctor', 
          doctorId: doctor.id, 
          doctorName: doctor.name,
          companyTheme 
        });
      }
    }

    return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
