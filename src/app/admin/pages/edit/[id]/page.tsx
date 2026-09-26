"use client";

import { useParams, useRouter } from 'next/navigation';
import PageBuilder from '../../../../../components/blocks/editor/PageBuilder';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  if (!id) return null;
  return <PageBuilder pageId={id} mode="page" onClose={() => router.push('/admin/pages')} />;
}
