type PermissionLevel = 'free_user' | 'paid_user' | 'admin' | 'moderator' | 'verification_required' ;

interface UserPermissions {
  id: string;
  useruuid: string;
  permission: PermissionLevel;
  created_at: string;
}

interface Window {
  showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
  webkitSpeechRecognition: typeof SpeechRecognition;
  SpeechRecognition: typeof SpeechRecognition;
}

interface Performance {
  memory?: {
    jsHeapSizeLimit: number;
    totalJSHeapSize: number;
    usedJSHeapSize: number;
  };
}
