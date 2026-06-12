import { useState } from 'react';
import { useAuthStore } from '../../store/auth';

export function SignIn() {
  const { status, email, signIn, backToSignIn } = useAuthStore();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const addr = input.trim();
    if (!addr) return;
    setSending(true);
    setError('');
    const { error } = await signIn(addr);
    setSending(false);
    if (error) setError(error);
    else setSent(true);
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen px-4">
      <div className="w-full max-w-sm animate-scale-in">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-primary edge-top-strong">
            <svg width="19" height="19" viewBox="0 0 16 16" fill="none">
              <path d="M8 1.5 13.5 4.75v6.5L8 14.5 2.5 11.25v-6.5L8 1.5Z" stroke="#fff" strokeWidth="1.1" strokeLinejoin="round" opacity="0.95" />
              <circle cx="8" cy="8" r="2" fill="#fff" />
            </svg>
          </div>
          <span className="text-lg font-semibold text-ink" style={{ letterSpacing: '-0.03em' }}>
            Job Search Copilot
          </span>
        </div>

        <div className="bg-surface-1 border border-hairline rounded-xl p-6 edge-top">
          {status === 'unauthorized' ? (
            <div className="text-center space-y-3">
              <h1 className="text-base font-semibold text-ink">This board is private</h1>
              <p className="text-[13px] text-ink-subtle leading-relaxed">
                That email isn't allowed to sign in. This is a personal job board for a single account.
              </p>
              <button
                onClick={() => { setSent(false); setInput(''); backToSignIn(); }}
                className="mt-2 text-[13px] text-primary hover:text-primary-hover"
              >
                Use a different email
              </button>
            </div>
          ) : sent ? (
            <div className="text-center space-y-3">
              <h1 className="text-base font-semibold text-ink">Check your inbox</h1>
              <p className="text-[13px] text-ink-subtle leading-relaxed">
                We sent a sign-in link to <span className="text-ink">{email}</span>. Open it on this device to continue.
              </p>
              <button
                onClick={() => setSent(false)}
                className="mt-2 text-[13px] text-primary hover:text-primary-hover"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <h1 className="text-base font-semibold text-ink">Sign in</h1>
                <p className="text-[13px] text-ink-subtle">
                  Enter your email and we'll send a one-click sign-in link — no password.
                </p>
              </div>
              <input
                type="email"
                required
                autoFocus
                value={input}
                onChange={(e) => { setInput(e.target.value); setError(''); }}
                placeholder="you@example.com"
                className="w-full bg-surface-2 border border-hairline rounded-md px-3 py-2 text-sm
                           text-ink placeholder:text-ink-tertiary outline-none
                           focus:border-primary-focus focus:ring-1 focus:ring-primary-focus/50"
              />
              {error && <p className="text-xs text-ink-muted">{error}</p>}
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="w-full py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium
                           rounded-md transition-colors disabled:opacity-40 edge-top-strong"
              >
                {sending ? 'Sending…' : 'Send magic link'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
