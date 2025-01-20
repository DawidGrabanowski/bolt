import { Dialog, DialogTitle, DialogDescription, DialogButton, DialogRoot } from '~/components/ui/Dialog';
import { supabase } from '~/lib/supabase/client';
import { toast } from 'react-toastify';

interface EmailVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  email?: string;
}

export function EmailVerificationModal({ isOpen, onClose, email }: EmailVerificationModalProps) {
  const resendVerificationEmail = async () => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email!,
      });
      if (error) throw error;
      toast.success('Verification email sent successfully');
    } catch (error) {
      toast.error('Failed to send verification email');
    }
  };

  return (
    <DialogRoot open={isOpen}>
      <Dialog>
        <DialogTitle>Email Verification Required</DialogTitle>
        <DialogDescription>
          Your email address has not been verified. Please check your inbox and verify your email to access all features.
        </DialogDescription>
        <div className="flex justify-end gap-2 px-5 py-4">
          <DialogButton type="secondary" onClick={onClose}>Close</DialogButton>
          <DialogButton type="primary" onClick={resendVerificationEmail}>Resend verification email</DialogButton>
        </div>
      </Dialog>
    </DialogRoot>
  );
}
