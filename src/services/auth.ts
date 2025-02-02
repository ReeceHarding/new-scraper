import { createClient, User, AuthResponse, Session, SupabaseClient, AuthError } from '@supabase/supabase-js';
import logger from './server-logger';
import { LRUCache } from 'lru-cache';
import { createHash } from 'crypto';

const defaultClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Rate limiting and attempt tracking
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes
const REGISTRATION_RATE_LIMIT = 3; // Max 3 registrations per IP per hour
const REGISTRATION_WINDOW = 60 * 60 * 1000; // 1 hour

// Password history and expiration settings
const PASSWORD_HISTORY_SIZE = 5; // Number of previous passwords to remember
const PASSWORD_EXPIRY_DAYS = 90; // Password expires after 90 days

// Session settings
const SESSION_EXPIRY_HOURS = 24; // Sessions expire after 24 hours

// In-memory caches for rate limiting and attempt tracking
const loginAttempts = new LRUCache<string, { attempts: number; lastAttempt: number }>({
  max: 10000,
  ttl: LOGIN_ATTEMPT_WINDOW,
});

const registrationAttempts = new LRUCache<string, { attempts: number; lastAttempt: number }>({
  max: 10000,
  ttl: REGISTRATION_WINDOW,
});

export interface AuthService {
  register(email: string, password: string, ip?: string, userAgent?: string): Promise<AuthResponse>;
  login(email: string, password: string, ip?: string, userAgent?: string): Promise<AuthResponse>;
  resetPassword(email: string): Promise<{ data: null; error: null }>;
  updatePassword(newPassword: string, userId: string): Promise<AuthResponse>;
  signOut(userId: string, sessionId: string): Promise<{ error: null }>;
  getUser(): Promise<{ data: { user: User | null; session: Session | null }; error: null }>;
  verifyEmail(token: string): Promise<{ data: null; error: null }>;
  forceLogoutAllSessions(userId: string): Promise<{ error: null }>;
  getActiveSessions(userId: string): Promise<{ data: any[] | null; error: Error | null }>;
  getSessions(): Promise<any[]>;
}

export class SupabaseAuthService implements AuthService {
  private client: SupabaseClient;

  constructor(client: SupabaseClient = defaultClient) {
    this.client = client;
  }

  private validateEmail(email: string): void {
    if (!EMAIL_REGEX.test(email)) {
      throw new Error('Invalid email format');
    }
  }

  private validatePassword(password: string): void {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
  }

  private checkRegistrationRateLimit(ip: string): void {
    const attempts = registrationAttempts.get(ip) || { attempts: 0, lastAttempt: Date.now() };
    
    if (attempts.attempts >= REGISTRATION_RATE_LIMIT) {
      const timeLeft = Math.ceil((REGISTRATION_WINDOW - (Date.now() - attempts.lastAttempt)) / 1000 / 60);
      throw new Error(`Registration rate limit exceeded. Please try again in ${timeLeft} minutes.`);
    }

    attempts.attempts++;
    attempts.lastAttempt = Date.now();
    registrationAttempts.set(ip, attempts);
  }

  private checkLoginAttempts(email: string): void {
    const attempts = loginAttempts.get(email) || { attempts: 0, lastAttempt: Date.now() };
    
    if (attempts.attempts >= MAX_LOGIN_ATTEMPTS) {
      const timeLeft = Math.ceil((LOGIN_ATTEMPT_WINDOW - (Date.now() - attempts.lastAttempt)) / 1000 / 60);
      throw new Error(`Too many failed login attempts. Please try again in ${timeLeft} minutes.`);
    }
  }

  private async recordLoginAttempt(email: string, success: boolean, ip?: string, userAgent?: string): Promise<void> {
    const attempts = loginAttempts.get(email) || { attempts: 0, lastAttempt: Date.now() };
    
    if (success) {
      // Reset attempts on successful login
      loginAttempts.delete(email);
    } else {
      attempts.attempts++;
      attempts.lastAttempt = Date.now();
      loginAttempts.set(email, attempts);

      // Log failed attempt
      logger.warn('Failed login attempt', { email, attempts: attempts.attempts });

      // Store failed attempt in database for audit
      try {
        await this.client.from('auth_audit_log').insert([{
          email,
          event_type: 'failed_login',
          attempts: attempts.attempts,
          ip_address: ip,
          user_agent: userAgent,
          created_at: new Date().toISOString()
        }]);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Failed to log auth audit', err);
      }
    }
  }

  private async checkPasswordHistory(userId: string, newPassword: string): Promise<void> {
    const passwordHash = createHash('sha256').update(newPassword).digest('hex');

    const { data: history } = await this.client
      .from('password_history')
      .select('password_hash')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(PASSWORD_HISTORY_SIZE);

    if (history && history.some(h => h.password_hash === passwordHash)) {
      throw new Error(`Cannot reuse any of your last ${PASSWORD_HISTORY_SIZE} passwords`);
    }
  }

  private async recordPasswordChange(userId: string, newPassword: string): Promise<void> {
    const passwordHash = createHash('sha256').update(newPassword).digest('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    // Add to password history
    await this.client.from('password_history').insert([{
      user_id: userId,
      password_hash: passwordHash,
      created_at: now.toISOString()
    }]);

    // Update profile with expiration
    await this.client.from('profiles').update({
      password_last_changed: now.toISOString(),
      password_expires_at: expiresAt.toISOString()
    }).eq('id', userId);

    // Clean up old password history
    const { data: oldPasswords } = await this.client
      .from('password_history')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(PASSWORD_HISTORY_SIZE, 1000);

    if (oldPasswords && oldPasswords.length > 0) {
      const oldIds = oldPasswords.map(p => p.id);
      await this.client.from('password_history').delete().in('id', oldIds);
    }
  }

  private async createSession(userId: string, sessionId: string, ip?: string, userAgent?: string): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

    await this.client.from('active_sessions').insert([{
      user_id: userId,
      session_id: sessionId,
      device_info: {},
      ip_address: ip,
      user_agent: userAgent,
      expires_at: expiresAt.toISOString(),
      created_at: now.toISOString()
    }]);
  }

  private async endSession(userId: string, sessionId: string, reason: string): Promise<void> {
    const now = new Date();

    // Get session details
    const sessionResult = await this.client
      .from('active_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .single();

    const session = sessionResult?.data;
    if (session) {
      // Move to history
      await this.client.from('session_history').insert([{
        user_id: userId,
        session_id: sessionId,
        device_info: session.device_info,
        ip_address: session.ip_address,
        user_agent: session.user_agent,
        started_at: session.created_at,
        ended_at: now.toISOString(),
        end_reason: reason,
        created_at: now.toISOString()
      }]);

      // Remove from active sessions
      await this.client
        .from('active_sessions')
        .delete()
        .eq('user_id', userId)
        .eq('session_id', sessionId);
    }
  }

  public async register(email: string, password: string): Promise<AuthResponse> {
    try {
      // Validate email and password
      this.validateEmail(email);
      this.validatePassword(password);

      // Check if email already exists
      try {
        const { error: resetError } = await this.client.auth.resetPasswordForEmail(email);
        if (!resetError) {
          throw new Error('Email already registered');
        }
      } catch (error) {
        // If we get a 422 error, it means the email doesn't exist, which is what we want
        if (error instanceof Error && error.message.includes('422')) {
          // Continue with registration
        } else if (error instanceof Error && error.message === 'Email already registered') {
          throw error;
        } else {
          // Don't throw here, continue with registration attempt
          console.error('Password reset check failed:', error);
        }
      }

      // Register the user
      let signUpResponse;
      try {
        signUpResponse = await this.client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined
          }
        });
      } catch (error) {
        logger.error('Registration failed', error instanceof Error ? error : new Error(String(error)));
        throw new Error('Registration failed');
      }

      if (!signUpResponse || signUpResponse.error) {
        throw new Error('Registration failed');
      }

      if (!signUpResponse.data?.user || !signUpResponse.data?.session) {
        throw new Error('Registration failed');
      }

      const userId = signUpResponse.data.user.id;

      try {
        // Create user profile
        const { error } = await this.client
          .from('profiles')
          .insert([
            {
              id: userId,
              email: email,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ]);

        if (error) {
          // Clean up the created user since profile creation failed
          try {
            await this.client.auth.admin.deleteUser(userId);
          } catch (cleanupError) {
            console.error('Failed to clean up user after profile creation error:', cleanupError);
          }
          throw new Error('Registration failed');
        }

        return {
          data: {
            user: signUpResponse.data.user,
            session: signUpResponse.data.session
          },
          error: null
        };
      } catch {
        // Clean up the created user since profile creation failed
        try {
          await this.client.auth.admin.deleteUser(userId);
        } catch (cleanupError) {
          console.error('Failed to clean up user after profile creation error:', cleanupError);
        }
        throw new Error('Registration failed');
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Registration failed');
    }
  }

  async login(email: string, password: string, ip?: string, userAgent?: string): Promise<AuthResponse> {
    try {
      // Check login attempts before proceeding
      this.checkLoginAttempts(email);

      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        await this.recordLoginAttempt(email, false, ip, userAgent);
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Login failed', err);
        throw new Error('Login failed');
      }

      // Record successful login
      await this.recordLoginAttempt(email, true, ip, userAgent);

      // Create session
      if (data.user && data.session) {
        await this.createSession(data.user.id, data.session.access_token, ip, userAgent);
      }

      // Log successful login
      try {
        await this.client.from('auth_audit_log').insert([{
          user_id: data.user?.id,
          email,
          event_type: 'login',
          ip_address: ip,
          user_agent: userAgent,
          created_at: new Date().toISOString()
        }]);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Failed to log auth audit', err);
      }

      logger.info('User logged in successfully', { email });
      return { data, error };
    } catch (error) {
      if (error instanceof AuthError) {
        await this.recordLoginAttempt(email, false, ip, userAgent);
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Login failed', err);
        throw new Error('Login failed');
      }
      if (error instanceof Error) {
        logger.error('Login error', error);
        throw new Error('Login failed');
      }
      throw new Error('Login failed');
    }
  }

  async resetPassword(email: string): Promise<{ data: null; error: null }> {
    try {
      const { error } = await this.client.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined,
      });

      if (error) {
        logger.error('Password reset error', error instanceof Error ? error : new Error(String(error)));
        throw error;
      }

      logger.info('Password reset email sent', { email });
      return { data: null, error: null };
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Password reset error', error);
      }
      throw error;
    }
  }

  async updatePassword(newPassword: string, userId: string): Promise<AuthResponse> {
    try {
      // Check password history
      await this.checkPasswordHistory(userId, newPassword);

      // Update password
      const { data: { user }, error } = await this.client.auth.updateUser({
        password: newPassword,
      });
      const { data: { session } } = await this.client.auth.getSession();

      if (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Failed to update password', err);
        throw error;
      }

      // Record password change
      await this.recordPasswordChange(userId, newPassword);

      logger.info('Password updated successfully');
      return { data: { user, session }, error };
    } catch (error) {
      if (error instanceof AuthError) {
        logger.error('Failed to update password', error);
      } else {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Failed to update password', err);
      }
      throw error;
    }
  }

  async signOut(userId: string, sessionId: string): Promise<{ error: null }> {
    try {
      const { error } = await this.client.auth.signOut();

      if (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Failed to sign out', err);
        throw error;
      }

      // End session
      await this.endSession(userId, sessionId, 'user_logout');

      logger.info('User signed out successfully');
      return { error: null };
    } catch (error) {
      if (error instanceof AuthError) {
        logger.error('Failed to sign out', error);
      } else {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Failed to sign out', err);
      }
      throw error;
    }
  }

  async getUser(): Promise<{ data: { user: User | null; session: Session | null }; error: null }> {
    try {
      const { data: userData, error: userError } = await this.client.auth.getUser();
      if (userError) {
        logger.error('Get user error:', userError);
        throw new Error('Get user failed');
      }

      const { data: sessionData, error: sessionError } = await this.client.auth.getSession();
      if (sessionError) {
        logger.error('Get session error:', sessionError);
        throw new Error('Get session failed');
      }

      return {
        data: {
          user: userData?.user || null,
          session: sessionData?.session || null,
        },
        error: null,
      };
    } catch (error) {
      logger.error('Get user/session error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async verifyEmail(token: string): Promise<{ data: null; error: null }> {
    try {
      const { error } = await this.client.auth.verifyOtp({ token_hash: token, type: 'email' });

      if (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Failed to verify email', err);
        throw error;
      }

      logger.info('Email verified successfully');
      return { data: null, error: null };
    } catch (error) {
      if (error instanceof AuthError) {
        logger.error('Failed to verify email', error);
      } else {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Failed to verify email', err);
      }
      throw error;
    }
  }

  async forceLogoutAllSessions(userId: string): Promise<{ error: null }> {
    try {
      // Get all active sessions
      const { data: sessions } = await this.client
        .from('active_sessions')
        .select('session_id')
        .eq('user_id', userId);

      if (sessions) {
        // End each session
        for (const session of sessions) {
          await this.endSession(userId, session.session_id, 'force_logout');
        }
      }

      // Force sign out from Supabase
      await this.client.auth.signOut({ scope: 'global' });

      logger.info('All sessions terminated successfully', { userId });
      return { error: null };
    } catch (error) {
      if (error instanceof AuthError) {
        logger.error('Failed to force logout', error);
      } else {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Failed to force logout', err);
      }
      throw error;
    }
  }

  async getActiveSessions(userId: string): Promise<{ data: any[] | null; error: Error | null }> {
    try {
      const { data, error } = await this.client
        .from('active_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Active sessions error', error instanceof Error ? error : new Error(String(error)));
        return { data: null, error };
      }

      return { data: data || [], error: null };
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Active sessions error', error);
      } else {
        const unknownError = new Error('Unknown error occurred');
        logger.error('Active sessions error', unknownError);
        return { data: null, error: unknownError };
      }
      return { data: null, error };
    }
  }

  async getSessions(): Promise<any[]> {
    try {
      const { data, error } = await this.client
        .from('active_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Get sessions error', error instanceof Error ? error : new Error(String(error)));
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('Get sessions error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}

export const authService = new SupabaseAuthService();