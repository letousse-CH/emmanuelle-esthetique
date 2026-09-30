"use client";

import React from 'react';
import { Pencil } from 'lucide-react';
import Link from 'next/link';
import { useAdminSession } from '../hooks/useAdminSession';

interface Props {
  href?: string;
  label?: string;
}

export default function AdminEditButton({ href = '/admin', label = 'Administration' }: Props) {
  const isAdmin = useAdminSession();

  if (!isAdmin) return null;

  return (
    <Link
      href={href}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-stone-900 text-white px-5 py-3 rounded-full shadow-2xl text-sm font-bold hover:bg-sage transition-colors duration-300"
    >
      <Pencil size={15} /> {label}
    </Link>
  );
}
