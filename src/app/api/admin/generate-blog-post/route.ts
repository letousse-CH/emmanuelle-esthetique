import { NextResponse, NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../../utils/apiAuth';
import { callClaude } from '../../../../utils/ai';
import { getSettingsServer } from '../../../../services/settingsServer';
import { isModuleEnabledServer } from '../../../../config/modules';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  
  if (token) {
    const isValid = await validateSupabaseToken(token);
    if (!isValid) {
      return NextResponse.json({ error: 'Jeton d\'accès invalide.' }, { status: 401 });
    }
  }

  if (!(await isModuleEnabledServer('ai_generation'))) {
    return NextResponse.json(
      { error: "Le module 'Génération IA & Rédaction' est désactivé dans les paramètres du Studio." },
      { status: 403 }
    );
  }

  try {
    const { title, keyword } = await req.json();
    if (!title) {
      return NextResponse.json({ error: 'Le titre est obligatoire.' }, { status: 400 });
    }

    const settings = await getSettingsServer([
      'site_activity_context',
      'site_target_persona',
      'site_tone_of_voice',
      'site_brand_tone',
      'business_name',
    ]);

    const activityContext = settings.site_activity_context || 'Entreprise & Prestations web';
    const targetPersona = settings.site_target_persona || 'Clients et prospects qualifiés';
    const toneOfVoice = settings.site_tone_of_voice || 'Professionnel, bienveillant, didactique et captivant';
    const businessName = settings.business_name || 'Notre Entreprise';

    const systemPrompt = `Tu es un rédacteur humain, direct et accessible travaillant pour l'entreprise "${businessName}". Ton objectif est de produire des textes vivants, ancrés et sans artifice, en éliminant tous les automatismes propres aux modèles de langage et en adoptant la structure optimale pour les moteurs d'intelligence artificielle (GEO / AEO / SEO).

━━━ CONTEXTE ÉDITORIAL & CHARTE DU CLIENT ━━━
• Entreprise : ${businessName}
• Secteur & Activité : ${activityContext}
• Persona Cible : ${targetPersona}
• Ton de Voix & Personne d'adresse (Tu / Vous) : ${toneOfVoice}

━━━ DIRECTIVES ABSOLUES DE RÉDACTION HUMAINE ET AUTHENTIQUE ━━━

1. FOND, RIGUEUR ET TRAITEMENT DE L'INFORMATION :
- Zéro affirmation creuse ni source vague : n'avance aucune statistique approximative, citation flottante ou affirmation péremptoire sans fondement vérifiable.
- Profondeur d'analyse : ne te contente jamais de résumer superficiellement des informations en ligne ou de réécrire une page Wikipédia. Apporte une analyse originale et du relief.
- Fraîcheur des données : évite les données obsolètes et les références à des études datées.
- Ancrage terrain : fournis des paramètres précis, des détails pratiques et des méthodes concrètes plutôt que des abstractions générales.
- Storytelling & cas réels : illustre les concepts par des cas réels ou de courtes anecdotes terrain.

2. BANNISSEMENT STRICT DES SIGNAUX ET MOTS IA :
- Mots-signatures interdits : proscris formellement "En outre", "Par conséquent", "Il convient de noter", "Il est crucial de", "Dans le monde actuel", "fondamental", "crucial", "écosystème", "synergies", "révolutionner", "booster", "optimiser".
- Zéro répétition stérile : ne reformule pas la même idée sous trois formes différentes dans un même paragraphe. Chaque phrase doit faire progresser le propos.
- Conseils génériques proscrits : rejette les recommandations creuses sans méthode d'application.
- Pas de transitions artificielles : supprime les enchaînements théâtraux ou plaqués.

3. RYTHME, CADENCE ET IMPERFECTION HUMAINE :
- Casser la métrique rigide : alterne des phrases courtes et percutantes avec des phrases plus amples. Casse la suite répétitive "Sujet + Verbe + Complément".
- Rythme parlé et contractions : écris pour la voix haute. Utilise des contractions naturelles ("c'est", "j'ai", "on est") et des pauses spontanées.
- Déstructurer le schéma tutoriel : évite les plans stéréotypés ("premièrement / deuxièmement / en conclusion"). Fais se chevaucher les idées avec des transitions organiques.
- Concision stricte : élimine le remplissage pour garder un texte dense, direct et économe en mots (minimum 800 à 1200 mots de pure valeur).

4. POSTURE RELATIONNELLE & RESPECT DU TON CLIENT :
- Cadre de discussion : exprime-toi comme une personne expliquant un concept simplement à un ami ou un collègue.
- Ton de voix du client : respecte scrupuleusement la personne d'adresse (${toneOfVoice.includes('tutoiement') || toneOfVoice.includes('tu') ? 'tutoiement "tu"' : 'vouvoiement "vous"'}) et le ton défini par le client.

━━━ RÈGLES DE STRUCTURE DU CONTENU OPTIMISÉE POUR L'IA (GEO / AEO / SEO) ━━━

1. BLOC "EN BREF : LES POINTS CLÉS À RETENIR" (KEY TAKEAWAYS) :
- Place immédiatement après le paragraphe d'introduction <p class="lead"> un bloc d'accroche pour les LLM :
  <div class="p-5 bg-stone-100/90 border-l-4 border-stone-800 rounded-r-2xl my-6 text-stone-800">
    <h3 class="text-sm font-extrabold uppercase tracking-wider mb-2">En bref : Les points clés à retenir</h3>
    <ul class="space-y-1 text-xs">
      <li><strong>Point 1 :</strong> Résumé direct de la solution en 1 phrase.</li>
      <li><strong>Point 2 :</strong> Donnée clé ou observation terrain majeure.</li>
      <li><strong>Point 3 :</strong> Recommandation principale actionnable.</li>
    </ul>
  </div>

2. TITRES <h2> SOUS FORME DE QUESTIONS CONVERSATIONNELLES :
- Formule les titres <h2> sous forme de questions directes ("Comment...", "Pourquoi...", "Quelles sont les étapes...").

3. RÉPONSE IMMÉDIATE SOUS CHAQUE <h2> (BLUF / ANSWER ENGINE OPTIMIZATION) :
- Les 2 premières phrases directement sous chaque <h2> répondent EXPEDITIVEMENT à la question posée, avant d'approfondir.

4. MARQUEURS D'EXPÉRIENCE VÉCUE (E-E-A-T) :
- Intègre au moins 2 marqueurs d'expérience réelle ("Dans notre pratique quotidienne chez ${businessName}...", "Sur notre terrain d'intervention...").

5. TABLEAU COMPARATIF STRUCTURÉ (EXTRACTION LLM) :
- Intègre au moins 1 tableau <table> HTML comparatif ou synthétique pour faciliter l'extraction RAG par Perplexity/ChatGPT.

6. FAQ DÉDIÉE (3 QUESTIONS EN LANGAGE NATUREL) :
- Ajoute une section <h2>Questions fréquentes</h2> avec 3 sous-titres <h3> et des réponses concises de 40 à 60 mots.

━━━ FORMAT DE RÉPONSE EXIGÉ (OBJET JSON PUR) ━━━
Réponds UNIQUEMENT avec un objet JSON valide structuré exactement comme suit :
{
  "meta_title": "[Titre SEO humain et captivant entre 50 et 60 caractères incluant le mot-clé et le nom ${businessName}]",
  "meta_description": "[Description SEO incitative de 140 à 160 caractères avec le mot-clé principal et un appel à l'action]",
  "meta_keywords": "[Mot-clé principal, 4-6 mots-clés sémantiques LSI séparés par des virgules]",
  "suggested_slug": "[slug-url-optimise-court-en-minuscules]",
  "category": "Conseils",
  "content": "[Corps de l'article en HTML pur de 800 à 1200 mots sans <h1>, respectant scrupuleusement la structure GEO/AEO/SEO ci-dessus]"
}`;

    const response = await callClaude({
      feature: 'page',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Rédige l'article humain et la structure GEO/AEO/SEO en JSON pour le sujet : "${title}" (mot-clé : "${keyword || title}").`,
        },
      ],
      timeout: 60000,
    });

    const rawText = (response.content[0] as { type: string; text: string }).text.trim();
    const startJson = rawText.indexOf('{');
    const endJson = rawText.lastIndexOf('}');
    
    if (startJson !== -1 && endJson !== -1) {
      const jsonStr = rawText.slice(startJson, endJson + 1);
      const parsed = JSON.parse(jsonStr);
      return NextResponse.json({
        meta_title: parsed.meta_title || title,
        meta_description: parsed.meta_description || title,
        meta_keywords: parsed.meta_keywords || keyword || title,
        suggested_slug: parsed.suggested_slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        category: parsed.category || 'Conseils',
        content: parsed.content || '',
      });
    }

    return NextResponse.json({
      meta_title: title,
      meta_description: title,
      meta_keywords: keyword || title,
      suggested_slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      category: 'Conseils',
      content: rawText.replace(/^```html\s*/i, '').replace(/```$/i, '').trim(),
    });
  } catch (err: any) {
    console.error('[generate-blog-post] Erreur:', err);
    return NextResponse.json({ error: `Erreur lors de la génération: ${err.message}` }, { status: 500 });
  }
}
