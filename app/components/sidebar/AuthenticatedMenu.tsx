import { useStore } from '@nanostores/react';
import { authStore } from '~/lib/stores/auth';
import { Menu } from './Menu.client';

export function AuthenticatedMenu() {
  const { user } = useStore(authStore);

  // Nie wyświetlaj menu jeśli użytkownik nie jest zalogowany lub email nie jest zweryfikowany
  if (!user || !user.email_confirmed_at) {
    return null;
  }

  return <Menu />;
}
