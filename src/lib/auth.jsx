import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase.js';

const AuthContext = createContext(null);

/** Aguarda a promise, mas resolve com fallback se demorar mais que ms. */
function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); return; }
    try {
      const { data, error } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        5000,
        { data: null, error: { message: 'timeout' } }
      );
      if (error) {
        console.error('loadProfile error:', error);
        setProfile(null);
        return;
      }
      setProfile(data ?? null);
    } catch (e) {
      console.error('loadProfile exception:', e);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await withTimeout(
          supabase.auth.getSession(),
          5000,
          { data: { session: null } }
        );
        if (!mounted) return;
        setSession(data.session);
        await loadProfile(data.session?.user?.id);
      } catch (e) {
        console.error('getSession exception:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess);
      await loadProfile(sess?.user?.id);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [loadProfile]);

  const signInDiscord = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: window.location.origin },
    });
    if (error) alert(error.message);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.assign('/');
  };

  const refreshProfile = () => loadProfile(session?.user?.id);

  return (
    <AuthContext.Provider value={{
      session, user: session?.user ?? null, profile, loading,
      signInDiscord, signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export function isProfileComplete(p) {
  return p && p.nome_completo && p.identificacao && p.discord_handle && p.conta_bancaria;
}
