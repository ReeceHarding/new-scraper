import { createClient, User, AuthResponse, Session, SupabaseClient } from '@supabase/supabase-js';
import logger from '../client-logger';

const defaultClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
const PASSWORD_EXPIRY_DAYS = 90;

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

  private async logAuthEvent(userId: string | undefined, email: string, eventType: string, metadata: any = {}) {
    try {
      await this.client.from('auth_audit_log').insert([{
        user_id: userId,
        email,
        event_type: eventType,
        ip_address: metadata.ip_address,
        user_agent: metadata.user_agent,
        metadata
      }]);
    } catch (error) {
      logger.error('Failed to log auth event', { error, userId, email, eventType });
    }
  }

  private async trackSession(userId: string, sessionId: string, metadata: any = {}) {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 day session expiry

      await this.client.from('active_sessions').insert([{
        user_id: userId,
        session_id: sessionId,
        device_info: metadata.device_info || {},
        ip_address: metadata.ip_address,
        user_agent: metadata.user_agent,
        expires_at: expiresAt.toISOString(),
        metadata
      }]);
    } catch (error) {
      logger.error('Failed to track session', { error, userId, sessionId });
    }
  }

  private async endSession(sessionId: string, endReason: string) {
    try {
      const { data: session } = await this.client
        .from('active_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (session) {
        // Move to history
        await this.client.from('session_history').insert([{
          user_id: session.user_id,
          session_id: session.session_id,
          device_info: session.device_info,
          ip_address: session.ip_address,
          user_agent: session.user_agent,
          started_at: session.created_at,
          ended_at: new Date().toISOString(),
          end_reason: endReason,
          metadata: session.metadata
        }]);

        // Remove from active sessions
        await this.client
          .from('active_sessions')
          .delete()
          .eq('session_id', sessionId);
      }
    } catch (error) {
      logger.error('Failed to end session', { error, sessionId });
    }
  }

  private async updatePasswordHistory(userId: string, passwordHash: string) {
    try {
      // Add to password history
      await this.client.from('password_history').insert([{
        user_id: userId,
        password_hash: passwordHash,
      }]);

      // Update password expiration
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + PASSWORD_EXPIRY_DAYS);

      await this.client
        .from('profiles')
        .update({
          password_last_changed: new Date().toISOString(),
          password_expires_at: expiresAt.toISOString()
        })
        .eq('id', userId);
    } catch (error) {
      logger.error('Failed to update password history', { error, userId });
    }
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
        await this.logAuthEvent(undefined, email, 'LOGIN_FAILED', { error: error.message });
        logger.error('Login failed', error);
        throw new Error('Login failed');
      }

      if (!data.user) {
        logger.error('No user data returned from login');
        throw new Error('Login failed');
      }

      if (data.user && data.session) {
        const metadata = {
          ip_address: await fetch('https://api.ipify.org?format=json').then(r => r.json()).then(data => data.ip),
          user_agent: window.navigator.userAgent
        };

        await Promise.all([
          this.trackSession(data.user.id, data.session.access_token, {
            ip_address: metadata.ip_address,
            user_agent: metadata.user_agent
          }),
          this.logAuthEvent(data.user.id, email, 'LOGIN_SUCCESS', metadata)
        ]);
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
      this.validatePassword(newPassword);

      const { data: { user }, error } = await this.client.auth.updateUser({
        password: newPassword,
      });
      const { data: { session } } = await this.client.auth.getSession();

      if (error) {
        logger.error('Failed to update password', error);
        throw error;
      }

      if (user) {
        await this.updatePasswordHistory(user.id, await this.hashPassword(newPassword));
        await this.logAuthEvent(user.id, user.email!, 'PASSWORD_UPDATED');
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

  private async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async signOut(): Promise<{ error: null }> {
    try {
      const { data: { session } } = await this.client.auth.getSession();
      const { error } = await this.client.auth.signOut();

      if (error) {
        logger.error('Failed to sign out', error);
        throw error;
      }

      if (session) {
        await this.endSession(session.access_token, 'USER_LOGOUT');
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