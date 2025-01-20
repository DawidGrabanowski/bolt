import type { Message } from 'ai';
import type { Template } from '~/types/template';
import { checkAuth } from '../auth/checkAuth';
import { createChatFromFolder } from '~/utils/folderImport';
import { toast } from 'react-toastify';
import { logStore } from '~/lib/stores/logs';
import { MAX_FILES, isBinaryFile, shouldIncludeFile } from '~/utils/fileUtils';

export const protectedImportActions = {
  handleStarterTemplateImport: (template: Template, callback: () => void): void => {
    if (!checkAuth(`/template/${template.name}`)) return;
    callback();
  },

  handleGitCloneImport: async (
    repoUrl: string,
    importChat: ((description: string, messages: Message[]) => Promise<void>) | undefined,
    description: string,
    messages: Message[]
  ): Promise<void> => {
    if (!checkAuth(`/git-clone?url=${encodeURIComponent(repoUrl)}`)) {
      return Promise.resolve();
    }

    try {
      if (importChat) {
        const loadingToast = toast.loading('Creating chat...');
        try {
          await importChat(description, messages);
          toast.success('Chat created successfully');
          // Wait a bit for the chat to be properly initialized
          await new Promise(resolve => setTimeout(resolve, 1000));
          // Reload the page to ensure proper chat initialization
          window.location.reload();
        } finally {
          toast.dismiss(loadingToast);
        }
      }
    } catch (error) {
      console.error('Error importing git repository:', error);
      toast.error('Failed to import repository');
    }
  },

  handleFileImport: async (file: File, importChat?: (description: string, messages: Message[]) => Promise<void>) => {
    if (!checkAuth('/file-import')) return;
    
    if (file && importChat) {
      try {
        const reader = new FileReader();
        return new Promise<void>((resolve, reject) => {
          reader.onload = async (e) => {
            try {
              const content = e.target?.result as string;
              const data = JSON.parse(content);

              if (!Array.isArray(data.messages)) {
                toast.error('Invalid chat file format');
                reject(new Error('Invalid chat file format'));
                return;
              }

              await importChat(data.description, data.messages);
              toast.success('Chat imported successfully');
              resolve();
            } catch (error: unknown) {
              if (error instanceof Error) {
                toast.error('Failed to parse chat file: ' + error.message);
              } else {
                toast.error('Failed to parse chat file');
              }
              reject(error);
            }
          };
          reader.onerror = () => {
            toast.error('Failed to read chat file');
            reject(new Error('Failed to read chat file'));
          };
          reader.readAsText(file);
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to import chat');
        throw error;
      }
    } else {
      toast.error('Something went wrong');
      throw new Error('Invalid file or import function');
    }
  },

  handleFolderImport: async (
    files: FileList,
    importChat?: (description: string, messages: Message[]) => Promise<void>
  ) => {
    if (!checkAuth('/folder-import')) return;

    const allFiles = Array.from(files);
    const filteredFiles = allFiles.filter((file) => {
      const path = file.webkitRelativePath.split('/').slice(1).join('/');
      return shouldIncludeFile(path);
    });

    const folderName = filteredFiles[0]?.webkitRelativePath.split('/')[0] || 'Unknown Folder';

    if (filteredFiles.length === 0) {
      const error = new Error('No valid files found');
      logStore.logError('File import failed - no valid files', error, { folderName });
      toast.error('No files found in the selected folder');
      return;
    }

    if (filteredFiles.length > MAX_FILES) {
      const error = new Error(`Too many files: ${filteredFiles.length}`);
      logStore.logError('File import failed - too many files', error, {
        fileCount: filteredFiles.length,
        maxFiles: MAX_FILES,
      });
      toast.error(
        `This folder contains ${filteredFiles.length.toLocaleString()} files. This product is not yet optimized for very large projects. Please select a folder with fewer than ${MAX_FILES.toLocaleString()} files.`
      );
      return;
    }

    const loadingToast = toast.loading(`Importing ${folderName}...`);

    try {
      const fileChecks = await Promise.all(
        filteredFiles.map(async (file) => ({
          file,
          isBinary: await isBinaryFile(file),
        }))
      );

      const textFiles = fileChecks.filter((f) => !f.isBinary).map((f) => f.file);
      const binaryFilePaths = fileChecks
        .filter((f) => f.isBinary)
        .map((f) => f.file.webkitRelativePath.split('/').slice(1).join('/'));

      if (textFiles.length === 0) {
        const error = new Error('No text files found');
        logStore.logError('File import failed - no text files', error, { folderName });
        toast.error('No text files found in the selected folder');
        return;
      }

      if (binaryFilePaths.length > 0) {
        logStore.logWarning(`Skipping binary files during import`, {
          folderName,
          binaryCount: binaryFilePaths.length,
        });
        toast.info(`Skipping ${binaryFilePaths.length} binary files`);
      }

      const messages = await createChatFromFolder(textFiles, binaryFilePaths, folderName);

      if (importChat) {
        await importChat(folderName, [...messages]);
      }

      logStore.logSystem('Folder imported successfully', {
        folderName,
        textFileCount: textFiles.length,
        binaryFileCount: binaryFilePaths.length,
      });
      toast.success('Folder imported successfully');
    } catch (error) {
      logStore.logError('Failed to import folder', error, { folderName });
      console.error('Failed to import folder:', error);
      toast.error('Failed to import folder');
      throw error;
    } finally {
      toast.dismiss(loadingToast);
    }
  },

  handleChatImport: (
    importChat: ((description: string, messages: Message[]) => Promise<void>) | undefined,
    description: string,
    messages: Message[]
  ): Promise<void> => {
    if (!checkAuth('/chat-import')) {
      return Promise.resolve();
    }
    return importChat?.(description, messages) ?? Promise.resolve();
  }
};
