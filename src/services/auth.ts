import { createClient, User, AuthResponse, Session, SupabaseClient } from '@supabase/supabase-js';
import logger from './logger';

const defaultClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface AuthService {
  register(email: string, password: string): Promise<AuthResponse>;
  login(email: string, password: string): Promise<AuthResponse>;
  resetPassword(email: string): Promise<{ data: null; error: null }>;
  updatePassword(newPassword: string): Promise<AuthResponse>;
  signOut(): Promise<{ error: null }>;
  getUser(): Promise<{ data: { user: User | null; session: Session | null }; error: null }>;
}

export class SupabaseAuthService implements AuthService {
  private client: SupabaseClient;

  constructor(client: SupabaseClient = defaultClient) {
    this.client = client;
  }

  async register(email: string, password: string): Promise<AuthResponse> {
    try {
      const { data, error } = await this.client.auth.signUp({
        email,
        password,
      });

      if (error) {
        logger.error(error);
        throw error;
      }

      logger.info('User registered successfully', { email });
      return { data, error };
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error);
      }
      throw error;
    }
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        logger.error(error);
        throw error;
      }

      logger.info('User logged in successfully', { email });
      return { data, error };
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error);
      }
      throw error;
    }
  }

  async resetPassword(email: string): Promise<{ data: null; error: null }> {
    try {
      const { error } = await this.client.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined,
      });

      if (error) {
        logger.error(error);
        throw error;
      }

      logger.info('Password reset email sent', { email });
      return { data: null, error: null };
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error);
      }
      throw error;
    }
  }

  async updatePassword(newPassword: string): Promise<AuthResponse> {
    try {
      const { data: { user }, error } = await this.client.auth.updateUser({
        password: newPassword,
      });
      const { data: { session } } = await this.client.auth.getSession();

      if (error) {
        logger.error(error);
        throw error;
      }

      logger.info('Password updated successfully');
      return { data: { user, session }, error };
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error);
      }
      throw error;
    }
  }

  async signOut(): Promise<{ error: null }> {
    try {
      const { error } = await this.client.auth.signOut();

      if (error) {
        logger.error(error);
        throw error;
      }

      logger.info('User signed out successfully');
      return { error: null };
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error);
      }
      throw error;
    }
  }

  async getUser(): Promise<{ data: { user: User | null; session: Session | null }; error: null }> {
    try {
      const { data: { user }, error } = await this.client.auth.getUser();
      const { data: { session } } = await this.client.auth.getSession();

      if (error) {
        logger.error(error);
        throw error;
      }

      return { data: { user, session }, error: null };
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error);
      }
      throw error;
    }
  }
}

export const authService = new SupabaseAuthService();