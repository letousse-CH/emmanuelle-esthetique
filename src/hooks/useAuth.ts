import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User, Session } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) console.error('Auth session error:', error.message);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Session expirée côté serveur → redirect immédiat depuis l'admin
      if ((event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) &&
          window.location.pathname.startsWith('/admin')) {
        window.location.href = '/login';
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, session, loading };
}
