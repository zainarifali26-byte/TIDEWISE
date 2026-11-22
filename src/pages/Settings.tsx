import { Database, Download, FileJson, Info, RotateCcw, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { download, toCSV } from '../lib/csv';
import { today } from '../lib/dates';
import { CURRENCIES } from '../lib/money';
import type { CurrencyCode, ThemePref } from '../lib/types';
import { useStore } from '../store/useStore';
import { useUI } from '../store/ui';

export default function Settings() {
  const s = useStore();
  const toast = useUI((u) => u.toast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<'fresh' | 'demo' | null>(null);
  const [name, setName] = useState(s.settings.name);

  const backup = () => {
    const { accounts, transactions, budgets, goals, settings } = useStore.getState();
    download(`tidewise-backup-${today()}.json`, JSON.stringify({ app: 'tidewise', version: 1, exportedAt: new Date().toISOString(), accounts, transactions, budgets, goals, settings }, null, 2), 'application/json');
    toast('Backup downloaded');
  };

  const restore = async (file?: File) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!s.importBackup(data)) throw new Error('bad');
      toast('Backup restored');
    } catch {
      toast('That file is not a Tidewise backup');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Preferences and your data. Everything is stored on this device only.</p>
        </div>
      </div>

      <div className="grid grid-dash">
        <section className="card span-7 settings-section" aria-labelledby="pref-title">
          <h2 id="pref-title" className="card-title" style={{ marginBottom: 4 }}>
            Preferences
          </h2>
          <div className="setting">
            <div>
              <h3>Your first name</h3>
              <p>Used in the greeting on the overview.</p>
            </div>
            <input
              className="input"
              style={{ maxWidth: 220 }}
              value={name}
              maxLength={30}
              aria-label="First name"
              onChange={(e) => setName(e.target.value)}
              onBlur={() => s.setSettings({ name: name.trim() || 'there' })}
            />
          </div>
          <div className="setting">
            <div>
              <h3>Currency</h3>
              <p>Changes how amounts are shown. It does not convert values.</p>
            </div>
            <select className="select" style={{ maxWidth: 220 }} value={s.settings.currency} aria-label="Currency" onChange={(e) => s.setSettings({ currency: e.target.value as CurrencyCode })}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="setting">
            <div>
              <h3>Theme</h3>
              <p>Follow your device, or pick one.</p>
            </div>
            <div className="segmented" role="radiogroup" aria-label="Theme">
              {(['system', 'light', 'dark'] as ThemePref[]).map((t) => (
                <button key={t} type="button" role="radio" aria-checked={s.settings.theme === t} onClick={() => s.setSettings({ theme: t })}>
                  {t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="setting">
            <div>
              <h3>Hide amounts</h3>
              <p>Blurs every number, for checking your finances in public. Shortcut: H.</p>
            </div>
            <button type="button" className="switch" role="switch" aria-checked={s.settings.hideAmounts} aria-label="Hide amounts" onClick={() => s.setSettings({ hideAmounts: !s.settings.hideAmounts })} />
          </div>
        </section>

        <section className="card span-5 settings-section" aria-labelledby="data-title">
          <h2 id="data-title" className="card-title" style={{ marginBottom: 4 }}>
            Your data
          </h2>
          <div className="setting">
            <div>
              <h3>Back up</h3>
              <p>Download everything as a JSON file you can restore later.</p>
            </div>
            <button type="button" className="btn btn-sm" onClick={backup}>
              <FileJson size={15} aria-hidden="true" /> Back up
            </button>
          </div>
          <div className="setting">
            <div>
              <h3>Restore</h3>
              <p>Load a Tidewise backup file. This replaces what is here now.</p>
            </div>
            <label className="btn btn-sm">
              <Upload size={15} aria-hidden="true" /> Restore
              <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => restore(e.target.files?.[0])} />
            </label>
          </div>
          <div className="setting">
            <div>
              <h3>Export transactions</h3>
              <p>A CSV that opens in Excel, Numbers or Google Sheets.</p>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                download(`tidewise-transactions-${today()}.csv`, toCSV(s.transactions, s.accounts));
                toast('CSV downloaded');
              }}
            >
              <Download size={15} aria-hidden="true" /> CSV
            </button>
          </div>
          <div className="setting">
            <div>
              <h3>Reload demo data</h3>
              <p>Bring back the sample finances, ending today.</p>
            </div>
            <button type="button" className="btn btn-sm" onClick={() => setConfirm('demo')}>
              <RotateCcw size={15} aria-hidden="true" /> Demo
            </button>
          </div>
          <div className="setting">
            <div>
              <h3>Start fresh</h3>
              <p>Clear everything and begin with one empty account.</p>
            </div>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => setConfirm('fresh')}>
              <Database size={15} aria-hidden="true" /> Clear
            </button>
          </div>
        </section>

        <div className="notice span-12">
          <Info size={18} aria-hidden="true" />
          <span>
            Tidewise is a concept app designed and built by{' '}
            <a href="https://zainaliarif.com" style={{ fontWeight: 600 }}>
              Zain Ali Arif
            </a>
            . The demo shows a fictional person; it is not connected to any bank, and no data leaves your browser.
          </span>
        </div>
      </div>

      {confirm && (
        <Modal
          title={confirm === 'fresh' ? 'Clear all data?' : 'Reload demo data?'}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${confirm === 'fresh' ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => {
                  if (confirm === 'fresh') s.startFresh();
                  else s.loadDemo();
                  toast(confirm === 'fresh' ? 'All data cleared' : 'Demo data loaded');
                  setConfirm(null);
                }}
              >
                {confirm === 'fresh' ? 'Clear everything' : 'Reload demo'}
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <p className="muted">
              {confirm === 'fresh'
                ? 'Your transactions, budgets, goals and accounts on this device will be removed. Back up first if you might want them again.'
                : 'This replaces your current accounts, transactions, budgets and goals with the sample data.'}
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
