import { requireAuth } from '../middleware/auth';
import type { Message } from 'ai';

export const protectedChatActions = {
  handleSendMessage: (
    sendMessage: ((event: React.UIEvent, messageInput?: string) => void) | undefined,
    recognition: SpeechRecognition | null,
    handleInputChange: ((event: React.ChangeEvent<HTMLTextAreaElement>) => void) | undefined,
    event: React.UIEvent,
    messageInput?: string
  ) => {
    return requireAuth(() => {
      if (sendMessage) {
        sendMessage(event, messageInput);

        if (recognition) {
          recognition.abort();
          if (handleInputChange) {
            const syntheticEvent = {
              target: { value: '' },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            handleInputChange(syntheticEvent);
          }
        }
      }
    });
  },

  handleFileUpload: (
    uploadedFiles: File[],
    setUploadedFiles?: (files: File[]) => void,
    setImageDataList?: (dataList: string[]) => void,
    imageDataList: string[] = []
  ) => {
    return requireAuth(() => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];

        if (file) {
          const reader = new FileReader();

          reader.onload = (e) => {
            const base64Image = e.target?.result as string;
            setUploadedFiles?.([...uploadedFiles, file]);
            setImageDataList?.([...imageDataList, base64Image]);
          };
          reader.readAsDataURL(file);
        }
      };

      input.click();
    });
  },

  handlePaste: (
    e: React.ClipboardEvent,
    uploadedFiles: File[],
    setUploadedFiles?: (files: File[]) => void,
    setImageDataList?: (dataList: string[]) => void,
    imageDataList: string[] = []
  ) => {
    return requireAuth(() => {
      const items = e.clipboardData?.items;

      if (!items) {
        return;
      }

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();

          const file = item.getAsFile();

          if (file) {
            const reader = new FileReader();

            reader.onload = (e) => {
              const base64Image = e.target?.result as string;
              setUploadedFiles?.([...uploadedFiles, file]);
              setImageDataList?.([...imageDataList, base64Image]);
            };
            reader.readAsDataURL(file);
          }

          break;
        }
      }
    });
  },

  handleImportChat: async (
    importChat: ((description: string, messages: Message[]) => Promise<void>) | undefined,
    description: string,
    messages: Message[]
  ): Promise<void> => {
    return requireAuth(async () => {
      if (importChat) {
        await importChat(description, messages);
      }
    });
  },

  handleExportChat: async (exportChat: (() => void) | undefined): Promise<void> => {
    return requireAuth(async () => {
      if (exportChat) {
        exportChat();
      }
    });
  }
};
