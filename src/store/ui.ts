import { create } from 'zustand';
import type { Transaction } from '../lib/types';

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

interface UIState {
  paletteOpen: boolean;
  txEditor: { open: boolean; tx?: Transaction };
  shortcutsOpen: boolean;
  toasts: Toast[];
  setPalette: (open: boolean) => void;
  openTx: (tx?: Transaction) => void;
  closeTx: () => void;
  setShortcuts: (open: boolean) => void;
  toast: (message: string, action?: Toast['action']) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useUI = create<UIState>()((set, get) => ({
  paletteOpen: false,
  txEditor: { open: false },
  shortcutsOpen: false,
  toasts: [],
  setPalette: (paletteOpen) => set({ paletteOpen }),
  openTx: (tx) => set({ txEditor: { open: true, tx }, paletteOpen: false }),
  closeTx: () => set({ txEditor: { open: false } }),
  setShortcuts: (shortcutsOpen) => set({ shortcutsOpen }),
  toast: (message, action) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, action }] }));
    setTimeout(() => get().dismiss(id), action ? 6000 : 3500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
