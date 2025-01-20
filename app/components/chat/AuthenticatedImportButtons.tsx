import { useStore } from '@nanostores/react';
import type { Message } from 'ai';
import { authStore } from '~/lib/stores/auth';
import { ImportButtons } from './chatExportAndImport/ImportButtons';
import GitCloneButton from './GitCloneButton';
import StarterTemplates from './StarterTemplates';

interface AuthenticatedImportButtonsProps {
  importChat?: (description: string, messages: Message[]) => Promise<void>;
}

export function AuthenticatedImportButtons({ importChat }: AuthenticatedImportButtonsProps) {
  const { user } = useStore(authStore);

  if (!user) {
    return null;
  }

  return (
    <>
      <div className="flex justify-center gap-2">
        {ImportButtons(importChat)}
        <GitCloneButton importChat={importChat} />
      </div>
      <StarterTemplates />
    </>
  );
}
