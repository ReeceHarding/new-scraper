import { createClient, User, AuthResponse, Session, SupabaseClient } from '@supabase/supabase-js';
import logger from '../client-logger';

const defaultClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AuthService {
  register(email: string, password: string): Promise<AuthResponse>;
  login(email: string, password: string): Promise<AuthResponse>;
  resetPassword(email: string): Promise<{ data: null; error: null }>;
  updatePassword(newPassword: string): Promise<AuthResponse>;
  signOut(): Promise<{ error: null }>;
  getUser(): Promise<{ data: { user: User | null; session: Session | null }; error: null }>;
  verifyEmail(token: string): Promise<{ data: null; error: null }>;
  updateProfile(data: { [key: string]: any }): Promise<AuthResponse>;
}

export class SupabaseAuthService implements AuthService {
  private client: SupabaseClient;

  constructor(client: SupabaseClient = defaultClient) {
    this.client = client;
  }

  private validatePassword(password: string): void {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    // Add more password validation rules as needed
  }

  private validateEmail(email: string): void {
    if (!EMAIL_REGEX.test(email)) {
      throw new Error('Invalid email format');
    }
  }

  async register(email: string, password: string): Promise<AuthResponse> {
    try {
      // Validate email and password first
      this.validateEmail(email);
      this.validatePassword(password);

      // Check if email exists
      try {
        const { error } = await this.client.auth.resetPasswordForEmail(email);
        if (!error) {
          throw new Error('Email already registered');
        }
      } catch (error) {
        if (error instanceof Error && error.message === 'Email already registered') {
          throw error;
        }
        // If error is not about existing email, continue with registration
        logger.error('Password reset check failed', error instanceof Error ? error : new Error(String(error)));
      }

      const { data: signUpData, error: signUpError } = await this.client.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        logger.error('Registration failed', signUpError);
        throw new Error('Registration failed');
      }

      if (!signUpData?.user || !signUpData?.session) {
        throw new Error('Registration failed');
      }

      // Create user profile
      const { error: profileError } = await this.client
        .from('profiles')
        .insert([
          {
            id: signUpData.user.id,
            email: email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .single();

      if (profileError) {
        // Clean up the created user since profile creation failed
        try {
          await this.client.auth.admin.deleteUser(signUpData.user.id);
        } catch (cleanupError) {
          logger.error('Failed to clean up user after profile creation error', cleanupError);
        }
        throw new Error('Registration failed');
      }

      logger.info('User registered successfully', { email });
      return {
        data: {
          user: signUpData.user,
          session: signUpData.session,
        },
        error: null,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Password must be at least 8 characters' || 
            error.message === 'Email already registered') {
          throw error;
        }
        logger.error('Registration error', error);
      }
      throw new Error('Registration failed');
    }
  }

  async verifyEmail(token: string): Promise<{ data: null; error: null }> {
    try {
      const { error } = await this.client.auth.verifyOtp({ token_hash: token, type: 'email' });

      if (error) {
        logger.error('Failed to verify email', error);
        throw error;
      }

      logger.info('Email verified successfully');
      return { data: null, error: null };
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Failed to verify email', error);
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
        logger.error('Login failed', error);
        throw new Error('Login failed');
      }

      if (!data.user) {
        logger.error('No user data returned from login');
        throw new Error('Login failed');
      }

      logger.info('User logged in successfully', { email });
      return { data, error: null };
    } catch (error) {
      logger.error('Login error', error instanceof Error ? error : new Error(String(error)));
      throw new Error('Login failed');
    }
  }

  async resetPassword(email: string): Promise<{ data: null; error: null }> {
    try {
      const { error } = await this.client.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        logger.error('Failed to reset password', error);
        throw error;
      }

      logger.info('Password reset email sent', { email });
      return { data: null, error: null };
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Failed to reset password', error);
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
        logger.error('Failed to update password', error);
        throw error;
      }

      logger.info('Password updated successfully');
      return { data: { user, session }, error };
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Failed to update password', error);
      }
      throw error;
    }
  }

  async signOut(): Promise<{ error: null }> {
    try {
      const { error } = await this.client.auth.signOut();

      if (error) {
        logger.error('Failed to sign out', error);
        throw error;
      }

      logger.info('User signed out successfully');
      return { error: null };
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Failed to sign out', error);
      }
      throw error;
    }
  }

  async getUser(): Promise<{ data: { user: User | null; session: Session | null }; error: null }> {
    try {
      const { data: { user }, error: userError } = await this.client.auth.getUser();
      if (userError) {
        logger.error('Failed to get user', { error: userError });
        throw new Error('Get user failed');
      }

      const { data: { session }, error: sessionError } = await this.client.auth.getSession();
      if (sessionError) {
        logger.error('Failed to get session', { error: sessionError });
        throw new Error('Get user failed');
      }

      return { data: { user, session }, error: null };
    } catch (error) {
      logger.error('Get user/session error', { error: error instanceof Error ? error.message : String(error) });
      throw new Error('Get user failed');
    }
  }

  async updateProfile(data: { [key: string]: any }): Promise<AuthResponse> {
    try {
      const { data: updateData, error } = await this.client.auth.updateUser({
        data: data
      });

      if (error) {
        logger.error('Failed to update profile', error);
        throw error;
      }

      // Get current session
      const { data: { session } } = await this.client.auth.getSession();

      logger.info('Profile updated successfully');
      return { 
        data: { 
          user: updateData.user,
          session: session
        }, 
        error: null 
      };
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Failed to update profile', error);
      }
      throw error;
    }
  }
}

export const authService = new SupabaseAuthService(); 