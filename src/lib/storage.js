import { useEffect, useState, useCallback } from 'react';

/**
 * Mantém um estado React sincronizado com localStorage.
 * - Lê uma vez no mount.
 * - Persiste a cada mudança.
 * - clearStored() limpa do storage e volta ao valor inicial.
 */
export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return typeof initial === 'function' ? initial() : initial;
      return JSON.parse(raw);
    } catch {
      return typeof initial === 'function' ? initial() : initial;
    }
  });

  useEffect(() => {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota cheia / modo privado etc. — ignora */
    }
  }, [key, value]);

  const clearStored = useCallback(() => {
    try { localStorage.removeItem(key); } catch {}
    setValue(typeof initial === 'function' ? initial() : initial);
  }, [key, initial]);

  return [value, setValue, clearStored];
}
