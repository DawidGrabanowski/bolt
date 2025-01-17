import { authStore } from '../stores/auth';

export function requireAuth(action: () => void | Promise<void>) {
  const { user, loading } = authStore.get();

  if (loading) {
    return;
  }

  if (!user) {
    // Store current URL for post-login redirect
    const currentPath = window.location.pathname;
    authStore.set({ ...authStore.get(), returnUrl: currentPath });
    window.location.href = '/auth/login';
    return;
  }

  return action();
}

export function withAuth<T extends (...args: any[]) => any>(fn: T): T {
  return ((...args: Parameters<T>) => {
    const { user, loading } = authStore.get();

    if (loading) {
      return;
    }

    if (!user) {
      const currentPath = window.location.pathname;
      authStore.set({ ...authStore.get(), returnUrl: currentPath });
      window.location.href = '/auth/login';
      return;
    }

    return fn(...args);
  }) as T;
}
