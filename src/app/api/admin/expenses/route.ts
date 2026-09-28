import { NextRequest, NextResponse } from 'next/server';
import { createExpense, listExpenses } from '../../../../services/financeService';

export async function GET() {
  try {
    const list = await listExpenses();
    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    return NextResponse.json(
      { error: 'Erreur chargement dépenses', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { expense, items } = body;

    if (!expense || !expense.fournisseur) {
      return NextResponse.json({ error: 'Données de facture invalides' }, { status: 400 });
    }

    const created = await createExpense(expense, items || []);
    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    return NextResponse.json(
      { error: 'Erreur création dépense', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
