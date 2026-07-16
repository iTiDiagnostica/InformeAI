import { NextResponse } from 'next/server';
import { db } from '@/services/dbService';

export async function GET() {
  try {
    const res = await db.query('SELECT key, value FROM system_settings');
    const settings = res.rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {} as Record<string, string>);
    return NextResponse.json(settings);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
