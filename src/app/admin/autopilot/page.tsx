import AutopilotClient from './AutopilotClient';

export const metadata = {
  title: 'Pilote automatique | Administration',
  description: 'Rédaction d’articles de blog à partir des sujets du Hub Mots-clés.',
};

export default function AutopilotPage() {
  return <AutopilotClient />;
}
