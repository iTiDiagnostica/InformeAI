import { NextResponse } from 'next/server';
import { db } from '@/services/dbService';

export async function GET() {
  try {
    await db.query('SELECT 1');
    return NextResponse.json({ status: 'ok', db: 'connected' });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', error: error.message }, { status: 500 });
  }
}
