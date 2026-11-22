import { Eye, EyeOff, Info, LayoutDashboard, Moon, PiggyBank, Plus, ReceiptText, Search, Sun, Target } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useUI } from '../store/ui';
import { CommandPalette } from './CommandPalette';
import { Modal } from './Modal';
import { NAV } from './nav';
import { Toasts } from './Toasts';
import { TransactionEditor } from './TransactionEditor';

export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
        <path d="M3 15c3-4 6-4 9 0s6 4 9 0" />
        <path d="M3 9c3-4 6-4 9 0s6 4 9 0" opacity=".55" />
      </svg>
    </span>
  );
}

function useTheme() {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const resolved = theme === 'system' ? (mq.matches ? 'light' : 'dark') : theme;
      document.documentElement.dataset.theme = resolved;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'light' ? '#f4f6f8' : '#090c11');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
}

function useShortcuts() {
  const navigate = useNavigate();
  const pendingG = useRef(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useUI.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ui.setPalette(!ui.paletteOpen);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e) || ui.paletteOpen || ui.txEditor.open || document.querySelector('[aria-modal="true"]')) return;
      const k = e.key.toLowerCase();
      if (Date.now() - pendingG.current < 900) {
        const hit = NAV.find((n) => n.key === k);
        pendingG.current = 0;
        if (hit) {
          e.preventDefault();
          navigate(hit.to);
        }
        return;
      }
      if (k === 'g') pendingG.current = Date.now();
      else if (k === 'n') {
        e.preventDefault();
        ui.openTx();
      } else if (k === '/') {
        e.preventDefault();
        ui.setPalette(true);
      } else if (k === '?') ui.setShortcuts(true);
      else if (k === 't') {
        const s = useStore.getState();
        s.setSettings({ theme: document.documentElement.dataset.theme === 'light' ? 'dark' : 'light' });
      } else if (k === 'h') {
        const s = useStore.getState();
        s.setSettings({ hideAmounts: !s.settings.hideAmounts });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);
}

const SHORTCUTS: [string, string][] = [
  ['⌘ K  /  Ctrl K', 'Open the command menu'],
  ['/', 'Search'],
  ['N', 'New transaction'],
  ['G then O, T, B, G, R, A, S', 'Go to a page'],
  ['T', 'Switch theme'],
  ['H', 'Hide or show amounts'],
  ['?', 'Show this list'],
];

export function Layout({ children }: { children: ReactNode }) {
  useTheme();
  useShortcuts();
  const loc = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const ui = useUI();
  const isDemo = useStore((s) => s.isDemo);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const txCount = useStore((s) => s.transactions.length);

  // Move focus to the page on route change, for keyboard and screen-reader users.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
  }, [loc.pathname]);

  const dark = settings.theme === 'dark' || (settings.theme === 'system' && !window.matchMedia('(prefers-color-scheme: light)').matches);

  return (
    <div className={`shell ${settings.hideAmounts ? 'blurred' : ''}`}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Main">
        <NavLink to="/" className="brand">
          <BrandMark /> Tidewise
        </NavLink>
        <nav aria-label="Pages">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <n.icon size={18} aria-hidden="true" />
              {n.label}
              {n.to === '/transactions' && <span className="nav-count num">{txCount}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          {isDemo && (
            <div className="demo-card">
              <strong>
                <Info size={14} aria-hidden="true" /> Demo data
              </strong>
              A fictional person’s finances, generated in your browser. Nothing leaves this device.
            </div>
          )}
          <p className="credit">
            Concept app by <a href="https://zainaliarif.com">Zain Ali Arif</a>
          </p>
        </div>
      </aside>

      <main className="main" id="main" ref={mainRef} tabIndex={-1}>
        <header className="topbar">
          <NavLink to="/" className="brand topbar-brand" aria-label="Tidewise, overview">
            <BrandMark size={28} />
          </NavLink>
          <button type="button" className="search-trigger" onClick={() => ui.setPalette(true)} aria-label="Search and commands">
            <Search size={17} aria-hidden="true" />
            <span>Search or jump to…</span>
            <kbd>⌘K</kbd>
          </button>
          <div className="topbar-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setSettings({ hideAmounts: !settings.hideAmounts })}
              aria-pressed={settings.hideAmounts}
              aria-label={settings.hideAmounts ? 'Show amounts' : 'Hide amounts'}
              title={settings.hideAmounts ? 'Show amounts (H)' : 'Hide amounts (H)'}
            >
              {settings.hideAmounts ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setSettings({ theme: dark ? 'light' : 'dark' })}
              aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
              title="Switch theme (T)"
            >
              {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            </button>
            <button type="button" className="btn btn-primary hide-sm" onClick={() => ui.openTx()}>
              <Plus size={17} aria-hidden="true" /> <span>Add</span>
            </button>
            <span className="avatar" aria-hidden="true">
              {settings.name.slice(0, 1).toUpperCase() || 'A'}
            </span>
          </div>
        </header>
        {children}
      </main>

      <nav className="tabbar" aria-label="Pages">
        {[
          { to: '/', label: 'Home', icon: LayoutDashboard },
          { to: '/transactions', label: 'Activity', icon: ReceiptText },
        ].map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
            <t.icon size={21} aria-hidden="true" />
            {t.label}
          </NavLink>
        ))}
        <button type="button" className="tab-add" onClick={() => ui.openTx()} aria-label="Add transaction">
          <Plus size={24} aria-hidden="true" />
        </button>
        {[
          { to: '/budgets', label: 'Budgets', icon: PiggyBank },
          { to: '/goals', label: 'Goals', icon: Target },
        ].map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
            <t.icon size={21} aria-hidden="true" />
            {t.label}
          </NavLink>
        ))}
      </nav>

      {ui.paletteOpen && <CommandPalette />}
      {ui.txEditor.open && <TransactionEditor key={ui.txEditor.tx?.id ?? 'new'} />}
      {ui.shortcutsOpen && (
        <Modal title="Keyboard shortcuts" onClose={() => ui.setShortcuts(false)}>
          <div className="dialog-body">
            <ul className="list">
              {SHORTCUTS.map(([k, d]) => (
                <li className="row" key={k}>
                  <span className="row-main">{d}</span>
                  <kbd>{k}</kbd>
                </li>
              ))}
            </ul>
          </div>
        </Modal>
      )}
      <Toasts />
    </div>
  );
}
