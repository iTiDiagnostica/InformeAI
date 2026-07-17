import { NextRequest, NextResponse } from 'next/server';
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

export async function PUT(req: NextRequest) {
  try {
    const { activeAiModel } = await req.json();
    if (!activeAiModel || (activeAiModel !== 'gemma' && activeAiModel !== 'gemini' && !activeAiModel.startsWith('gemini-') && !activeAiModel.startsWith('groq-'))) {
      return NextResponse.json({ error: 'Modelo de IA inválido.' }, { status: 400 });
    }
    
    await db.query(
      "INSERT INTO system_settings (key, value) VALUES ('active_ai_model', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
      [activeAiModel]
    );
    console.log(`⚙️ Configuración de IA cambiada a: ${activeAiModel}`);
    return NextResponse.json({ activeAiModel });
  } catch (error: any) {
    console.error('Error al actualizar configuración:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

