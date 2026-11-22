import { CornerDownLeft, Download, Eye, Keyboard, MoonStar, Plus, Search } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { getCategory } from '../lib/categories';
import { download, toCSV } from '../lib/csv';
import { fmt, today } from '../lib/dates';
import { useStore } from '../store/useStore';
import { useUI } from '../store/ui';
import { CategoryIcon } from './CategoryIcon';
import { useFocusTrap } from './Modal';
import { useMoney } from './Money';
import { NAV } from './nav';

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
}

export function CommandPalette() {
  const close = () => useUI.getState().setPalette(false);
  const navigate = useNavigate();
  const money = useMoney();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useFocusTrap(ref, close, inputRef);

  const items = useMemo<Item[]>(() => {
    const s = useStore.getState();
    const ui = useUI.getState();
    const go = (to: string) => () => {
      navigate(to);
      close();
    };
    const base: Item[] = [
      ...NAV.map((n) => ({ id: `nav-${n.to}`, group: 'Go to', label: n.label, hint: n.key ? `G then ${n.key.toUpperCase()}` : undefined, icon: <n.icon size={17} aria-hidden="true" />, run: go(n.to) })),
      { id: 'add', group: 'Actions', label: 'Add a transaction', hint: 'N', icon: <Plus size={17} aria-hidden="true" />, run: () => ui.openTx() },
      {
        id: 'theme',
        group: 'Actions',
        label: 'Switch light / dark theme',
        hint: 'T',
        icon: <MoonStar size={17} aria-hidden="true" />,
        run: () => {
          const dark = document.documentElement.dataset.theme !== 'light';
          s.setSettings({ theme: dark ? 'light' : 'dark' });
          close();
        },
      },
      {
        id: 'hide',
        group: 'Actions',
        label: s.settings.hideAmounts ? 'Show amounts' : 'Hide amounts (privacy)',
        hint: 'H',
        icon: <Eye size={17} aria-hidden="true" />,
        run: () => {
          s.setSettings({ hideAmounts: !s.settings.hideAmounts });
          close();
        },
      },
      {
        id: 'csv',
        group: 'Actions',
        label: 'Export transactions as CSV',
        icon: <Download size={17} aria-hidden="true" />,
        run: () => {
          download(`tidewise-transactions-${today()}.csv`, toCSV(s.transactions, s.accounts));
          ui.toast('CSV downloaded');
          close();
        },
      },
      {
        id: 'keys',
        group: 'Actions',
        label: 'Keyboard shortcuts',
        hint: '?',
        icon: <Keyboard size={17} aria-hidden="true" />,
        run: () => {
          close();
          ui.setShortcuts(true);
        },
      },
    ];
    const needle = q.trim().toLowerCase();
    if (!needle) return base;
    const filtered = base.filter((i) => i.label.toLowerCase().includes(needle));
    const tx =
      needle.length >= 2
        ? s.transactions
            .filter((t) => t.merchant.toLowerCase().includes(needle) || getCategory(t.categoryId).name.toLowerCase().includes(needle))
            .slice(0, 6)
            .map<Item>((t) => ({
              id: `tx-${t.id}`,
              group: 'Transactions',
              label: t.merchant,
              hint: `${fmt.short(t.date)} · ${money(t.amount)}`,
              icon: <CategoryIcon id={t.categoryId} size={26} />,
              run: () => ui.openTx(t),
            }))
        : [];
    return [...filtered, ...tx];
  }, [q, navigate, money]);

  const safeSel = Math.min(sel, Math.max(0, items.length - 1));

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((safeSel + 1) % Math.max(1, items.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((safeSel - 1 + items.length) % Math.max(1, items.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[safeSel]?.run();
    }
  };

  let lastGroup = '';
  return createPortal(
    <div className="overlay top" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command menu" ref={ref}>
        <div className="palette-input">
          <Search size={18} className="muted" aria-hidden="true" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={onKey}
            placeholder="Search pages, actions or transactions…"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items[safeSel] ? `pi-${items[safeSel].id}` : undefined}
            aria-autocomplete="list"
          />
          <kbd>Esc</kbd>
        </div>
        <div className="palette-list" id="palette-list" role="listbox" aria-label="Results">
          {items.length === 0 && <p className="empty">No matches for “{q}”.</p>}
          {items.map((it, i) => {
            const head = it.group !== lastGroup;
            lastGroup = it.group;
            return (
              <div key={it.id} role="presentation">
                {head && (
                  <div className="palette-group" role="presentation">
                    {it.group}
                  </div>
                )}
                <button
                  type="button"
                  id={`pi-${it.id}`}
                  role="option"
                  aria-selected={i === safeSel}
                  className="palette-item"
                  tabIndex={-1}
                  onMouseMove={() => setSel(i)}
                  onClick={it.run}
                >
                  {it.icon}
                  <span>{it.label}</span>
                  {it.hint && <span className="hint num">{it.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="palette-foot" aria-hidden="true">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> move
          </span>
          <span>
            <kbd>
              <CornerDownLeft size={10} />
            </kbd>{' '}
            open
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
