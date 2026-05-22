import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const SettingsContext = createContext(null);

const DEFAULTS = {
  commission_pct: 0.25,
  farm_name: 'Fazenda Rockefeller',
  categorias: [
    'Frutas, Grãos & Vegetais',
    'Laticínios',
    'Animais & Insumos',
    'Especiarias & Outros',
    'Matérias-primas',
    'Sacos',
  ],
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('settings').select('key, value');
    if (error) { console.error('settings load', error); setLoaded(true); return; }
    const map = { ...DEFAULTS };
    (data || []).forEach(({ key, value }) => { map[key] = value; });
    setSettings(map);
    setLoaded(true);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const setSetting = async (key, value) => {
    const { error } = await supabase
      .from('settings')
      .upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw error;
    await carregar();
  };

  return (
    <SettingsContext.Provider value={{ settings, loaded, setSetting, refresh: carregar }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);

/** Helpers convenientes */
export const useCommissionPct = () => useSettings()?.settings?.commission_pct ?? DEFAULTS.commission_pct;
export const useWorkerPct = () => 1 - useCommissionPct();
export const useCategorias = () => useSettings()?.settings?.categorias ?? DEFAULTS.categorias;
