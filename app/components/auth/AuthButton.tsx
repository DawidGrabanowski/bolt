import { useStore } from '@nanostores/react';
import { authStore, authActions } from '~/lib/stores/auth';
import { classNames } from '~/utils/classNames';

export function AuthButton() {
  const { user, loading } = useStore(authStore);

  const handleAuth = async () => {
    if (user) {
      await authActions.signOut();
    } else {
      // Store current URL as return URL
      const currentPath = window.location.pathname;
      authActions.setReturnUrl(currentPath);
      window.location.href = '/auth/login';
    }
  };

  return (
    <button
      onClick={handleAuth}
      disabled={loading}
      className={classNames(
        'flex items-center gap-2 px-3 py-1.5 rounded-md transition-all',
        'text-sm font-medium',
        {
          'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent': !!user,
          'bg-bolt-elements-item-backgroundDefault text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive': !user,
          'opacity-50 cursor-not-allowed': loading
        }
      )}
    >
      {loading ? (
        <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress animate-spin" />
      ) : user ? (
        <>
          <div className="i-ph:sign-out text-sm" />
          Sign Out
        </>
      ) : (
        <>
          <div className="i-ph:sign-in text-sm" />
          Sign In
        </>
      )}
    </button>
  );
}
