import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AIProvider } from '../types';

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
  apiKey: string;
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
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      apiKey: ENV_KEY,
      provider: ENV_PROVIDER,
      openRouterModel: ENV_MODEL,
      searchModel: ENV_SEARCH_MODEL,
      resumeText: '',
      resumeFileName: '',
      setApiKey: (apiKey) => set({ apiKey }),
      setProvider: (provider) => set({ provider }),
      setOpenRouterModel: (openRouterModel) => set({ openRouterModel }),
      setSearchModel: (searchModel) => set({ searchModel }),
      setResume: (resumeText, resumeFileName) => set({ resumeText, resumeFileName }),
    }),
    {
      name: 'jsc-settings',
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
