"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Printer } from 'lucide-react';
import { useSettings } from '../../../../hooks/useSettings';
import { Button } from '../../../../components/admin/ui';
import { formatCHF, listeDePrix } from '../../../../types/caisse';
import type { GroupePrix, Product } from '../../../../types/caisse';
import './liste-prix.css';

/**
 * Bouton « Imprimer la liste de prix » et sa fiche A4 : les produits vente
 * actifs à leur prix de vente du moment, à ressortir à chaque commande
 * fournisseur. Ni prix d'achat ni marge.
 *
 * La fiche est montée dans <body> par un portail, invisible à l'écran
 * (`liste-prix.css`) : à l'impression elle seule sort, y compris par Cmd+P
 * depuis cette page — imprimer le menu et la liste de l'admin ne sert à rien.
 */
export default function ListePrix({ products, tvaActive }: { products: Product[]; tvaActive: boolean }) {
  const institut = useSettings(['business_name']).business_name;
  const groupes = useMemo(() => listeDePrix(products), [products]);
  const total = groupes.reduce((n, g) => n + g.lignes.length, 0);
  const [editeLe, setEditeLe] = useState(() => new Date());

  // Date d'édition = jour de l'impression, même si la page est restée ouverte
  // depuis la veille. `beforeprint` précède la mise en page de la feuille.
  useEffect(() => {
    const maj = () => flushSync(() => setEditeLe(new Date()));
    window.addEventListener('beforeprint', maj);
    return () => window.removeEventListener('beforeprint', maj);
  }, []);

  return (
    <>
      <Button
        icon={Printer}
        onClick={() => window.print()}
        disabled={total === 0}
        title={total === 0 ? 'Aucun produit actif à la vente' : 'Fiche A4 des prix de vente, sans prix d’achat ni marge'}
      >
        Imprimer la liste de prix
      </Button>
      {/* Les produits arrivent après l'hydratation : le portail n'existe jamais côté serveur. */}
      {total > 0 && typeof document !== 'undefined' && createPortal(
        <FichePrix groupes={groupes} total={total} institut={institut} editeLe={editeLe} tvaActive={tvaActive} />,
        document.body,
      )}
    </>
  );
}

function FichePrix({ groupes, total, institut, editeLe, tvaActive }: {
  groupes: GroupePrix[];
  total: number;
  institut: string;
  editeLe: Date;
  tvaActive: boolean;
}) {
  const lignes = groupes.flatMap(g => g.lignes);
  const avecContenance = lignes.some(l => l.contenance);
  const avecReference = lignes.some(l => l.reference);
  const colonnes = 2 + Number(avecContenance) + Number(avecReference);
  // Un seul groupe sans marque : une liste alphabétique, sans intertitre.
  const intertitres = groupes.length > 1 || groupes[0]?.marque !== null;

  return (
    <div className="lp-sheet">
      <header className="lp-head">
        <div>
          {institut && <p className="lp-institut">{institut}</p>}
          <h1 className="lp-title">Liste de prix</h1>
          <p className="lp-sub">Produits en vente · {total} {total > 1 ? 'articles' : 'article'}</p>
        </div>
        <p className="lp-date">
          Édition du
          <strong>{editeLe.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
        </p>
      </header>

      <table className="lp-table">
        <thead>
          <tr>
            <th scope="col">Produit</th>
            {avecContenance && <th scope="col">Contenance</th>}
            {avecReference && <th scope="col">Référence</th>}
            <th scope="col" className="lp-num">Prix</th>
          </tr>
        </thead>
        {groupes.map(g => (
          <tbody key={g.marque ?? ''} className="zebra">
            {intertitres && (
              <tr className="lp-group">
                <th scope="colgroup" colSpan={colonnes}>{g.marque ?? 'Autres produits'}</th>
              </tr>
            )}
            {g.lignes.map(l => (
              <tr key={l.id}>
                <td className="lp-nom">{l.nom}</td>
                {avecContenance && <td>{l.contenance}</td>}
                {avecReference && <td className="lp-ref">{l.reference}</td>}
                <td className="lp-num">
                  {l.prix > 0 ? formatCHF(l.prix) : <span className="lp-muted">à définir</span>}
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>

      {/* Pas de mention de TVA tant que l'activité n'est pas assujettie : une
          TVA écrite serait due (LTVA art. 27 al. 2). */}
      <p className="lp-foot">
        Prix de vente en francs suisses{tvaActive ? ', TVA comprise' : ''}.
      </p>
    </div>
  );
}
