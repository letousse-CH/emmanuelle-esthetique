import { NextResponse, NextRequest } from 'next/server';
import { isAdminRequest } from '../../../../utils/apiAuth';
import { getAutopilotConfig, saveAutopilotConfig, runAutopilotCycle } from '../../../../services/autopilotService';

export const runtime = 'nodejs';
// Un cycle attend la rédaction complète d'un article par l'IA : les 10 s par
// défaut des fonctions Netlify ne suffisent pas.
export const maxDuration = 60;

/**
 * Session admin obligatoire. Le contrôle ne s'appliquait auparavant que si un
 * jeton était fourni : une requête sans en-tête pouvait lancer un cycle
 * (article rédigé par l'IA, donc facturé, puis publié) ou changer les réglages.
 */
async function isAdmin(req: NextRequest): Promise<boolean> {
  return isAdminRequest(req);
}

const UNAUTHORIZED = { error: 'Votre session a expiré. Reconnectez-vous puis réessayez.' };

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json(UNAUTHORIZED, { status: 401 });
  try {
    const config = await getAutopilotConfig();
    return NextResponse.json(config);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json(UNAUTHORIZED, { status: 401 });

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
