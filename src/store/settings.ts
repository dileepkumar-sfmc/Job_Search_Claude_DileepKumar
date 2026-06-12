import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AIProvider } from '../types';
import { supabase, AUTH_ENABLED } from './../lib/supabase';
import { useUiStore } from './ui';

// SECURITY: Vite inlines `import.meta.env.VITE_*` into the bundle at build time,
// so a built-in key would ship in plaintext to every visitor of a production
// build. Only auto-load the key from server/.env during local development
// (`import.meta.env.DEV`). In a production build `DEV` is `false`, so this whole
// expression constant-folds to '' and the key literal is stripped from the
// output — end users must supply their own key at runtime via Settings.
const ENV_KEY = import.meta.env.DEV
  ? (import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined) ||
    (import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined) ||
    (import.meta.env.VITE_OPENAI_API_KEY as string | undefined) ||
    ''
  : '';
const ENV_PROVIDER = (import.meta.env.VITE_AI_PROVIDER as AIProvider | undefined) || 'openrouter';
const ENV_MODEL = (import.meta.env.VITE_OPENROUTER_MODEL as string | undefined) || 'anthropic/claude-sonnet-4-6';
const ENV_SEARCH_MODEL = (import.meta.env.VITE_OPENROUTER_SEARCH_MODEL as string | undefined) || 'perplexity/sonar-pro';

interface SettingsStore {
  apiKey: string; // local-only — never synced to Supabase
  provider: AIProvider;
  openRouterModel: string;
  searchModel: string;
  resumeText: string;
  resumeFileName: string;
  setApiKey: (key: string) => void;
  setProvider: (p: AIProvider) => void;
  setOpenRouterModel: (model: string) => void;
  setSearchModel: (model: string) => void;
  setResume: (text: string, fileName: string) => void;
  /** Pull the synced fields (resume + prefs) from Supabase after sign-in. */
  load: () => Promise<void>;
}

// Write-through the synced fields to the user's row (fire-and-forget; the API
// key is deliberately excluded). Keys here are DB column names.
async function pushSettings(partial: Record<string, unknown>) {
  if (!AUTH_ENABLED) return; // auth off → settings live only in localStorage
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: auth.user.id, ...partial, updated_at: new Date().toISOString() });
  if (error) useUiStore.getState().notify('Could not save settings.');
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      apiKey: ENV_KEY,
      provider: ENV_PROVIDER,
      openRouterModel: ENV_MODEL,
      searchModel: ENV_SEARCH_MODEL,
      resumeText: '',
      resumeFileName: '',

      setApiKey: (apiKey) => set({ apiKey }), // local only
      setProvider: (provider) => {
        set({ provider });
        void pushSettings({ provider });
      },
      setOpenRouterModel: (openRouterModel) => {
        set({ openRouterModel });
        void pushSettings({ open_router_model: openRouterModel });
      },
      setSearchModel: (searchModel) => {
        set({ searchModel });
        void pushSettings({ search_model: searchModel });
      },
      setResume: (resumeText, resumeFileName) => {
        set({ resumeText, resumeFileName });
        void pushSettings({ resume_text: resumeText, resume_file_name: resumeFileName });
      },

      load: async () => {
        if (!AUTH_ENABLED) return; // auth off → already rehydrated from localStorage
        const { data, error } = await supabase.from('user_settings').select('*').maybeSingle();
        if (error) {
          useUiStore.getState().notify('Could not load settings.');
          return;
        }
        if (data) {
          set({
            resumeText: data.resume_text ?? '',
            resumeFileName: data.resume_file_name ?? '',
            provider: (data.provider as AIProvider) ?? get().provider,
            openRouterModel: data.open_router_model ?? get().openRouterModel,
            searchModel: data.search_model ?? get().searchModel,
          });
        } else {
          // No row yet — seed one from whatever is local (first sign-in).
          const s = get();
          await pushSettings({
            resume_text: s.resumeText,
            resume_file_name: s.resumeFileName,
            provider: s.provider,
            open_router_model: s.openRouterModel,
            search_model: s.searchModel,
          });
        }
      },
    }),
    {
      name: 'jsc-settings',
      // Only the API key (and its provider/model context) need to persist
      // locally; the resume + synced prefs are reloaded from Supabase on sign-in.
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<SettingsStore>),
        apiKey: (persisted as Partial<SettingsStore>)?.apiKey || ENV_KEY,
        provider: (persisted as Partial<SettingsStore>)?.provider || ENV_PROVIDER,
        openRouterModel: (persisted as Partial<SettingsStore>)?.openRouterModel || ENV_MODEL,
        searchModel: (persisted as Partial<SettingsStore>)?.searchModel || ENV_SEARCH_MODEL,
      }),
    }
  )
);
