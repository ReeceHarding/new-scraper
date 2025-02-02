import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { authService } from '@/services/auth/client';
import logger from '@/services/client-logger';

interface UseAuthReturn {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: Error | null;
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  updateProfile: (data: { [key: string]: any }) => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { user, session }, error } = await authService.getUser();
        if (error) throw error;
        
        setUser(user);
        setSession(session);
      } catch (err) {
        logger.error('Failed to initialize auth', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const register = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await authService.register(email, password);
      if (error) throw error;
      
      setUser(data.user);
      setSession(data.session);
    } catch (err) {
      logger.error('Failed to register user', err);
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await authService.login(email, password);
      if (error) throw error;
      
      setUser(data.user);
      setSession(data.session);
    } catch (err) {
      logger.error('Failed to login user', err);
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      setError(null);
      const { error } = await authService.signOut();
      if (error) throw error;
      
      setUser(null);
      setSession(null);
    } catch (err) {
      logger.error('Failed to logout user', err);
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      setLoading(true);
      setError(null);
      const { error } = await authService.resetPassword(email);
      if (error) throw error;
    } catch (err) {
      logger.error('Failed to reset password', err);
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await authService.updatePassword(newPassword);
      if (error) throw error;
      
      setUser(data.user);
    } catch (err) {
      logger.error('Failed to update password', err);
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const verifyEmail = async (token: string) => {
    try {
      setLoading(true);
      setError(null);
      const { error } = await authService.verifyEmail(token);
      if (error) throw error;
    } catch (err) {
      logger.error('Failed to verify email', err);
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (data: { [key: string]: any }) => {
    try {
      setLoading(true);
      setError(null);
      const { data: userData, error } = await authService.updateProfile(data);
      if (error) throw error;
      
      setUser(userData.user);
      setSession(userData.session);
    } catch (err) {
      logger.error('Failed to update profile', err);
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    session,
    loading,
    error,
    register,
    login,
    logout,
    resetPassword,
    updatePassword,
    verifyEmail,
    updateProfile,
  };
} 