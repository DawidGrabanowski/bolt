import { useStore } from '@nanostores/react';
import { useState } from 'react';
import { useNavigate } from '@remix-run/react';
import { authStore, authActions } from '~/lib/stores/auth';
import { classNames } from '~/utils/classNames';
import BackgroundRays from '~/components/ui/BackgroundRays';

export default function Login() {
  const navigate = useNavigate();
  const { loading, returnUrl } = useStore(authStore);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const result = await authActions.signIn(email, password);
    
    if (result.error) {
      setError(result.error instanceof Error ? result.error.message : 'Failed to sign in');
      return;
    }

    // Navigate back to the return URL or home page
    navigate(returnUrl || '/');
    authActions.setReturnUrl(null);
  };

  return (
    <div className="flex flex-col min-h-screen bg-bolt-elements-background-depth-1">
      <BackgroundRays />
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <a href="/" className="inline-block">
              <img src="/logo-light-styled.png" alt="logo" className="w-[120px] inline-block dark:hidden" />
              <img src="/logo-dark-styled.png" alt="logo" className="w-[120px] inline-block hidden dark:block" />
            </a>
            <h2 className="mt-6 text-2xl font-bold text-bolt-elements-textPrimary">Sign in to your account</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-md">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-bolt-elements-textSecondary">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={classNames(
                  'mt-1 block w-full px-3 py-2 rounded-md',
                  'bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor',
                  'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                  'focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus'
                )}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-bolt-elements-textSecondary">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={classNames(
                  'mt-1 block w-full px-3 py-2 rounded-md',
                  'bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor',
                  'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                  'focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus'
                )}
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className={classNames(
                  'w-full flex justify-center py-2 px-4 rounded-md',
                  'text-sm font-medium text-white',
                  'bg-bolt-elements-item-backgroundAccent hover:bg-bolt-elements-item-backgroundAccentHover',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bolt-elements-focus',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {loading ? (
                  <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress animate-spin" />
                ) : (
                  'Sign in'
                )}
              </button>
            </div>

            <div className="text-center text-sm">
              <span className="text-bolt-elements-textSecondary">Don't have an account? </span>
              <a
                href="/auth/register"
                className="font-medium text-bolt-elements-item-contentAccent hover:text-bolt-elements-item-contentAccentHover"
              >
                Sign up
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
