import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Ao mudar de rota: rola para o topo e move o foco para <main>
 * (anuncia "navegou para nova página" em leitores de tela).
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    const main = document.querySelector('main.shell');
    if (main) {
      // Foco programático sem outline visual permanente
      main.setAttribute('tabindex', '-1');
      main.focus({ preventScroll: true });
      main.addEventListener('blur', () => main.removeAttribute('tabindex'), { once: true });
    }
  }, [pathname]);
  return null;
}
