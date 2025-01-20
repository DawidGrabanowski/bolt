import { authStore, authActions } from '../stores/auth';

export const checkAuth = (returnPath: string) => {
  const { user } = authStore.get();
  if (!user) {
    // Store return path with action type
    authActions.setReturnUrl(returnPath);
    // Immediate redirect to login
    window.location.href = '/auth/login';
    return false;
  }
  return true;
};
