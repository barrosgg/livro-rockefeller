import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from './supabase.js';

const AuthContext = createContext(null);

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
  /* Indica se a tentativa inicial de carregar o perfil terminou.
     Antes disso, o Protected mostra loader em vez de redirecionar. */
  const [profileReady, setProfileReady] = useState(false);

  /* Evita chamadas duplicadas concorrentes de loadProfile */
  const loadingProfileRef = useRef(false);

  /** Carrega o profile. Em erro NÃO zera o profile existente (evita
      perder o estado bom quando há um erro transiente que dispara F5
      voltando para /perfil). */
  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      setProfileReady(true);
      return;
    }
    if (loadingProfileRef.current) return;
    loadingProfileRef.current = true;
    try {
      const { data, error } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        5000,
        { data: null, error: { message: 'timeout' } }
      );
      if (error) {
        console.error('loadProfile error:', error);
        // mantém o profile anterior (não zera)
        return;
      }
      if (data) setProfile(data);
      // se data é null E ainda não temos profile, deixa null (usuário sem profile)
      // se data é null mas já tinhamos profile, mantém (transiente)
    } catch (e) {
      console.error('loadProfile exception:', e);
    } finally {
      setProfileReady(true);
      loadingProfileRef.current = false;
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

    /* Responde a SIGNED_IN/SIGNED_OUT apenas — ignoramos TOKEN_REFRESHED
       e USER_UPDATED para não recarregar profile à toa. */
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === 'SIGNED_IN') {
        setSession(sess);
        loadProfile(sess?.user?.id);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setProfile(null);
        setProfileReady(true);
      }
      // TOKEN_REFRESHED: só atualiza session, mantém profile
      else if (event === 'TOKEN_REFRESHED') {
        setSession(sess);
      }
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
    // limpa drafts ao deslogar
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('draft:')) localStorage.removeItem(k);
      });
    } catch {}
    window.location.assign('/');
  };

  const refreshProfile = () => loadProfile(session?.user?.id);

  return (
    <AuthContext.Provider value={{
      session, user: session?.user ?? null, profile, loading, profileReady,
      signInDiscord, signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export function isProfileComplete(p) {
  return !!(p && p.nome_completo && p.identificacao && p.discord_handle && p.conta_bancaria);
}
