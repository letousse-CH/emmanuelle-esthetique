import { NextResponse, NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../../utils/apiAuth';
import { getAutopilotConfig, saveAutopilotConfig, runAutopilotCycle } from '../../../../services/autopilotService';

export async function GET(req: NextRequest) {
  try {
    const config = await getAutopilotConfig();
    return NextResponse.json(config);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  
  if (token) {
    const isValid = await validateSupabaseToken(token);
    if (!isValid) {
      return NextResponse.json({ error: 'Jeton d\'accès invalide.' }, { status: 401 });
    }
  }

  try {
    const body = await req.json();

    if (body.action === 'trigger_now') {
      const origin = req.nextUrl.origin;
      const result = await runAutopilotCycle(origin);
      return NextResponse.json(result);
    }

    await saveAutopilotConfig({
      enabled: body.enabled,
      frequency: body.frequency,
      mode: body.mode,
    });

    const updated = await getAutopilotConfig();
    return NextResponse.json({ ok: true, config: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
