import { useStore } from '@nanostores/react';
import { authStore } from '~/lib/stores/auth';
import StarterTemplates from './StarterTemplates';

export function AuthenticatedStarterTemplates() {
  const { user } = useStore(authStore);

  if (!user || !user.email_confirmed_at) {
    return null;
  }

  return <StarterTemplates />;
}
