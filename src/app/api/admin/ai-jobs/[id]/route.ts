/**
 * État d'une tâche IA longue : GET → { id, kind, status, result, error, … }.
 *
 * Profite de chaque interrogation pour débloquer une tâche : relance une
 * tâche restée en attente (déclenchement perdu), et marque en erreur une
 * tâche jamais démarrée ou interrompue.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { isAdminRequest } from '../../../../../utils/apiAuth';
import { expireIfStale, getJob, touchJob } from '../../../../../services/aiJobs';
import { dispatchJob } from '../../../../../services/aiJobDispatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Délai après lequel une tâche toujours en attente est relancée. */
const RETRIGGER_AFTER_MS = 30_000;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Votre session a expiré. Reconnectez-vous puis réessayez.' }, { status: 401 });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id || '')) {
    return NextResponse.json({ error: 'Identifiant de tâche invalide.' }, { status: 400 });
  }

  try {
    let job = await getJob(id);
    if (!job) return NextResponse.json({ error: 'Tâche introuvable.' }, { status: 404 });

    job = await expireIfStale(job);

    if (job.status === 'pending') {
      const lastTouch = Date.parse(job.updated_at || job.created_at);
      if (Date.now() - lastTouch > RETRIGGER_AFTER_MS) {
        await touchJob(id);
        await dispatchJob(id);
      }
    }

    return NextResponse.json(
      {
        id: job.id,
        kind: job.kind,
        status: job.status,
        result: job.status === 'done' ? job.result : null,
        error: job.status === 'error' ? job.error : null,
        created_at: job.created_at,
        started_at: job.started_at,
        finished_at: job.finished_at,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err: any) {
    console.error('[ai-jobs] Lecture impossible :', err);
    return NextResponse.json({ error: err?.message || 'Lecture de la tâche impossible.' }, { status: 500 });
  }
}
