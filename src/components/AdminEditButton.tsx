"use client";

import React, { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '../services/supabase';

interface Props {
  href?: string;
  label?: string;
}

export default function AdminEditButton({ href = '/admin', label = 'Administration' }: Props) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setIsAdmin(!!data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setIsAdmin(!!s));
    return () => subscription.unsubscribe();
  }, []);

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
