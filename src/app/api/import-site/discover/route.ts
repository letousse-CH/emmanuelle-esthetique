/**
 * Découverte des pages d'un site, avant import.
 *
 * Étape séparée de la reconstruction : elle ne coûte aucun appel au modèle et
 * sert seulement à dresser la liste que l'utilisateur va cocher. Importer
 * quinze pages sans les avoir choisies serait présomptueux — et coûteux.
 */
import { NextResponse, type NextRequest } from 'next/server';

import { validateSupabaseToken } from '../../../../utils/apiAuth';
import { discoverPages } from '../../../../services/siteDiscover';
import { UnsafeUrlError } from '../../../../utils/safeFetch';

export const runtime = 'nodejs';
export const maxDuration = 45;

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!(await validateSupabaseToken(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const url = String(body?.url ?? '').trim();
  if (!url) return NextResponse.json({ error: 'Adresse manquante.' }, { status: 400 });

  try {
    const result = await discoverPages(url);

    if (result.pages.length === 0) {
      return NextResponse.json(
        { error: "Aucune page n'a pu être trouvée sur ce site." },
        { status: 422 },
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof UnsafeUrlError ? error.message : "Impossible d'explorer ce site.",
      },
      { status: 422 },
    );
  }
}
