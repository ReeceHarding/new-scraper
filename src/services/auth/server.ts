import { createClient, User, AuthResponse, Session, SupabaseClient } from '@supabase/supabase-js';
import logger from '../server-logger';

const defaultClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_EXPIRY_DAYS = 90; // Password expires after 90 days

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

      // Hash password using our custom function
      const hashedPassword = await this.hashPassword(password);

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

      // Create user profile with hashed password
      if (data.user) {
        const { error: profileError } = await this.client
          .from('profiles')
          .insert([{
            id: data.user.id,
            email: data.user.email,
            password_hash: hashedPassword,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }]);

        if (profileError) {
          logger.error(profileError.message, profileError);
          throw profileError;
        }

        // Initialize password history
        await this.updatePasswordHistory(data.user.id, hashedPassword);
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
      // Get user profile with hashed password
      const { data: profile, error: profileError } = await this.client
        .from('profiles')
        .select('id, password_hash')
        .eq('email', email)
        .single();

      if (profileError || !profile) {
        await this.logAuthEvent(undefined, email, 'LOGIN_FAILED', { error: 'User not found' });
        logger.error('User not found', { email });
        throw new Error('Invalid email or password');
      }

      // Verify password
      const isValid = await this.verifyPassword(password, profile.password_hash);
      if (!isValid) {
        await this.logAuthEvent(undefined, email, 'LOGIN_FAILED', { error: 'Invalid password' });
        logger.error('Invalid password', { email });
        throw new Error('Invalid email or password');
      }

      // Create session
      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        await this.logAuthEvent(undefined, email, 'LOGIN_FAILED', { error: error.message });
        logger.error(error.message, error);
        throw error;
      }

      if (data.user && data.session) {
        const metadata = {
          ip_address: typeof window !== 'undefined' ? await fetch('https://api.ipify.org?format=json').then(r => r.json()).then(data => data.ip) : undefined,
          user_agent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined
        };

        await Promise.all([
          this.trackSession(data.user.id, data.session.access_token, {
            ip_address: metadata.ip_address,
            user_agent: metadata.user_agent
          }),
          this.logAuthEvent(data.user.id, email, 'LOGIN_SUCCESS')
        ]);
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
      // Validate new password
      this.validatePassword(newPassword);

      // Get current user
      const { data: { user }, error: userError } = await this.client.auth.getUser();
      if (userError || !user) {
        logger.error('Failed to get user', userError);
        throw new Error('Failed to update password');
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);

      // Update password in auth system
      const { data, error } = await this.client.auth.updateUser({
        password: newPassword
      });

      if (error) {
        logger.error('Failed to update password in auth system', error);
        throw error;
      }

      // Get current session
      const { data: { session }, error: sessionError } = await this.client.auth.getSession();
      if (sessionError) {
        logger.error('Failed to get session', sessionError);
        throw sessionError;
      }

      // Update password hash in profile
      const { error: profileError } = await this.client
        .from('profiles')
        .update({
          password_hash: hashedPassword,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) {
        logger.error('Failed to update password hash in profile', profileError);
        throw profileError;
      }

      // Update password history
      await this.updatePasswordHistory(user.id, hashedPassword);

      logger.info('Password updated successfully', { userId: user.id });
      return { data: { user: data.user, session }, error: null };
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error.message, error);
      }
      throw error;
    }
  }

  async signOut(): Promise<{ error: null }> {
    try {
      const { data: { session } } = await this.client.auth.getSession();
      const { error } = await this.client.auth.signOut();

      if (error) {
        logger.error(error.message, error);
        throw error;
      }

      if (session) {
        await Promise.all([
          this.endSession(session.access_token, 'USER_LOGOUT'),
          this.logAuthEvent(session.user.id, session.user.email!, 'LOGOUT_SUCCESS')
        ]);
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

  private async hashPassword(password: string): Promise<string> {
    try {
      const { data, error } = await this.client.rpc('hash_password', {
        password
      });

      if (error) {
        logger.error('Failed to hash password', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Failed to hash password', error);
      throw new Error('Failed to hash password');
    }
  }

  private async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
      const { data, error } = await this.client.rpc('verify_password', {
        password,
        hashed_password: hashedPassword
      });

      if (error) {
        logger.error('Failed to verify password', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Failed to verify password', error);
      throw new Error('Failed to verify password');
    }
  }
}

export const authService = new SupabaseAuthService(); 