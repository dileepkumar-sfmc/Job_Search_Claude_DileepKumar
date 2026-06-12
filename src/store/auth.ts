import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, supabaseReady, ALLOWED_EMAIL } from '../lib/supabase';

type AuthStatus = 'loading' | 'signed-out' | 'signed-in' | 'unauthorized';

interface AuthStore {
  status: AuthStatus;
  user: User | null;
  email: string; // last address a magic link was sent to (for the "check inbox" screen)
  init: () => void;
  signIn: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  backToSignIn: () => void;
}

let initialized = false;
// True while we deliberately sign out a disallowed account, so the resulting
// null-session event doesn't clobber the 'unauthorized' message with 'signed-out'.
let rejecting = false;

export const useAuthStore = create<AuthStore>((set) => ({
  status: supabaseReady ? 'loading' : 'signed-out',
  user: null,
  email: '',

  init: () => {
    if (!supabaseReady || initialized) return;
    initialized = true;

    const apply = (session: Session | null) => {
      const user = session?.user ?? null;
      if (!user) {
        if (rejecting) { rejecting = false; return; } // keep 'unauthorized'
        set({ status: 'signed-out', user: null });
        return;
      }
      if ((user.email ?? '').toLowerCase() !== ALLOWED_EMAIL.toLowerCase()) {
        rejecting = true;
        set({ status: 'unauthorized', user: null });
        void supabase.auth.signOut();
        return;
      }
      set({ status: 'signed-in', user });
    };

    void supabase.auth.getSession().then(({ data }) => apply(data.session));
    supabase.auth.onAuthStateChange((_event, session) => apply(session));
  },

  signIn: async (email) => {
    set({ email });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    return error ? { error: error.message } : {};
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ status: 'signed-out', user: null });
  },

  backToSignIn: () => set({ status: 'signed-out' }),
}));
