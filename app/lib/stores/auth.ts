import { atom } from 'nanostores';
import { supabase } from '../supabase/client';
import type { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  loading: boolean;
  returnUrl: string | null;
  showEmailVerificationModal: boolean;
}

export const authStore = atom<AuthState>({
  user: null,
  loading: true,
  returnUrl: null,
  showEmailVerificationModal: false,
});

export const authActions = {
  showEmailVerificationModal: () => {
    authStore.set({ ...authStore.get(), showEmailVerificationModal: true });
  },

  hideEmailVerificationModal: () => {
    authStore.set({ ...authStore.get(), showEmailVerificationModal: false });
  },

  setUser: (user: User | null) => {
    authStore.set({ ...authStore.get(), user, loading: false });
  },

  setLoading: (loading: boolean) => {
    authStore.set({ ...authStore.get(), loading });
  },

  setReturnUrl: (url: string | null) => {
    authStore.set({ ...authStore.get(), returnUrl: url });
  },

  signIn: async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      authStore.set({ ...authStore.get(), user: data.user, loading: false });
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  signUp: async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      authStore.set({ ...authStore.get(), user: data.user, loading: false });
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Reset auth state
      authStore.set({ ...authStore.get(), user: null, loading: false });

      // Reset chat state and navigate to home
      import('~/lib/stores/chat').then(({ chatStore }) => {
        chatStore.set({
          started: false,
          aborted: false,
          showChat: true
        });
      });

      // Navigate to home page
      window.location.href = '/';
      
      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  initializeAuth: async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      // Even if there's an error, we want to set loading to false and continue
      if (error) {
        console.error('Auth session error:', error);
        authStore.set({ ...authStore.get(), user: null, loading: false });
        return;
      }

      // Set the user state based on session
      authStore.set({
        ...authStore.get(),
        user: session?.user || null,
        loading: false
      });

      // Set up auth state change subscription
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          console.log('Auth state changed:', event, session?.user?.email);
          authStore.set({
            ...authStore.get(),
            user: session?.user || null,
            loading: false
          });
        }
      );

      // Return cleanup function
      return () => {
        subscription.unsubscribe();
      };
    } catch (error) {
      console.error('Error initializing auth:', error);
      // Ensure we set loading to false even if initialization fails
      authStore.set({ ...authStore.get(), user: null, loading: false });
    }
  }
};
