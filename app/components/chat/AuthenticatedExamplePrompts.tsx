import { useStore } from '@nanostores/react';
import { authStore } from '~/lib/stores/auth';
import { ExamplePrompts } from './ExamplePrompts';

interface AuthenticatedExamplePromptsProps {
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
}

export function AuthenticatedExamplePrompts({ sendMessage }: AuthenticatedExamplePromptsProps) {
  const { user } = useStore(authStore);

  if (!user || !user.email_confirmed_at) {
    return null;
  }

  return <ExamplePrompts sendMessage={sendMessage} />;
}
