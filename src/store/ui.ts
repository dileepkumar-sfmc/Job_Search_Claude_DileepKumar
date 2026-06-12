import { create } from 'zustand';

/**
 * Minimal transient-notice store. Used by the Supabase-backed stores to surface
 * a brief error when a sync write fails (we revert the optimistic change and
 * call notify()). Rendered as a small banner in App.
 */
interface UiStore {
  error: string;
  notify: (message: string) => void;
  clear: () => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

export const useUiStore = create<UiStore>((set) => ({
  error: '',
  notify: (error) => {
    set({ error });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => set({ error: '' }), 5000);
  },
  clear: () => {
    if (timer) clearTimeout(timer);
    set({ error: '' });
  },
}));
