import { createClient, User, AuthResponse, Session, SupabaseClient } from '@supabase/supabase-js';
import logger from '../server-logger';

const defaultClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AuthService {
  register(email: string, password: string): Promise<AuthResponse>;
  login(email: string, password: string): Promise<AuthResponse>;
  resetPassword(email: string): Promise<{ data: null; error: null }>;
  updatePassword(newPassword: string): Promise<AuthResponse>;
  signOut(): Promise<{ error: null }>;
  getUser(): Promise<{ data: { user: User | null; session: Session | null }; error: null }>;
  verifyEmail(token: string): Promise<{ data: null; error: null }>;
}

export class SupabaseAuthService implements AuthService {
  private client: SupabaseClient;

  constructor(client: SupabaseClient = defaultClient) {
    this.client = client;
  }

  private validatePassword(password: string): void {
    if (!PASSWORD_REGEX.test(password)) {
      throw new Error(
        'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      );
    }
  }

  private validateEmail(email: string): void {
    if (!EMAIL_REGEX.test(email)) {
      throw new Error('Invalid email format');
    }
  }

  async register(email: string, password: string): Promise<AuthResponse> {
    try {
      // Validate email format first
      this.validateEmail(email);

      // Check if email already exists
      const { data: existingUsers } = await this.client
        .from('profiles')
        .select('id')
        .eq('email', email)
        .limit(1);

      if (existingUsers && existingUsers.length > 0) {
        throw new Error('Email already registered');
      }

      // Validate password after email check
      this.validatePassword(password);

      // Register user with email verification
      const { data, error } = await this.client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: typeof window !== 'undefined' 
            ? `${window.location.origin}/auth/verify` 
            : undefined,
        },
      });

      if (error) {
        logger.error(error.message, error);
        throw error;
      }

      // Create user profile
      if (data.user) {
        const { error: profileError } = await this.client
          .from('profiles')
          .insert([{
            id: data.user.id,
            email: data.user.email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }]);

        if (profileError) {
          logger.error(profileError.message, profileError);
          throw profileError;
        }
      }

      logger.info('User registered successfully', { email });
      return { data, error: null };
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error.message, error);
      }
      throw error;
    }
  }

  async verifyEmail(token: string): Promise<{ data: null; error: null }> {
    try {
      const { error } = await this.client.auth.verifyOtp({ token_hash: token, type: 'email' });

      if (error) {
        logger.error(error.message, error);
        throw error;
      }

      logger.info('Email verified successfully');
      return { data: null, error: null };
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error.message, error);
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
        logger.error(error.message, error);
        throw error;
      }

      logger.info('User logged in successfully', { email });
      return { data, error };
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error.message, error);
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
        logger.error(error.message, error);
        throw error;
      }

      logger.info('Password reset email sent', { email });
      return { data: null, error: null };
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error.message, error);
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
        logger.error(error.message, error);
        throw error;
      }

      logger.info('Password updated successfully');
      return { data: { user, session }, error };
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error.message, error);
      }
      throw error;
    }
  }

  async signOut(): Promise<{ error: null }> {
    try {
      const { error } = await this.client.auth.signOut();

      if (error) {
        logger.error(error.message, error);
        throw error;
      }

      logger.info('User signed out successfully');
      return { error: null };
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error.message, error);
      }
      throw error;
    }
  }

  async getUser(): Promise<{ data: { user: User | null; session: Session | null }; error: null }> {
    try {
      const { data: { user }, error } = await this.client.auth.getUser();
      const { data: { session } } = await this.client.auth.getSession();

      if (error) {
        logger.error(error.message, error);
        throw error;
      }

      return { data: { user, session }, error: null };
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error.message, error);
      }
      throw error;
    }
  }
}

export const authService = new SupabaseAuthService(); 