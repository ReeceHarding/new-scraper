import { AuthService, SupabaseAuthService } from '@/services/auth';
import { createClient } from '@supabase/supabase-js';
import logger from '@/services/logger';

// Mock window.location
const mockWindow = {
  location: {
    origin: 'http://localhost',
  },
};
(global as any).window = mockWindow;

// Mock logger
jest.mock('@/services/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
}));

describe('AuthService', () => {
  let authService: AuthService;
  let mockClient: any;

  const mockUser = {
    id: '123',
    email: 'test@example.com',
    role: 'authenticated',
  };

  const mockSession = {
    access_token: 'mock-token',
    refresh_token: 'mock-refresh-token',
    expires_at: Date.now() + 3600,
  };

  beforeEach(() => {
    mockClient = {
      auth: {
        signUp: jest.fn(() => Promise.resolve({
          data: { user: mockUser, session: mockSession },
          error: null,
        })),
        signInWithPassword: jest.fn(() => Promise.resolve({
          data: { user: mockUser, session: mockSession },
          error: null,
        })),
        resetPasswordForEmail: jest.fn(() => Promise.resolve({
          data: null,
          error: null,
        })),
        updateUser: jest.fn(() => Promise.resolve({
          data: { user: mockUser },
          error: null,
        })),
        signOut: jest.fn(() => Promise.resolve({
          error: null,
        })),
        getUser: jest.fn(() => Promise.resolve({
          data: { user: mockUser },
          error: null,
        })),
        getSession: jest.fn(() => Promise.resolve({
          data: { session: mockSession },
          error: null,
        })),
      },
    };
    authService = new SupabaseAuthService(mockClient);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const result = await authService.register('test@example.com', 'password123');

      expect(result.data.user).toEqual(mockUser);
      expect(result.data.session).toEqual(mockSession);
      expect(mockClient.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(logger.info).toHaveBeenCalledWith('User registered successfully', {
        email: 'test@example.com',
      });
    });

    it('should handle registration error', async () => {
      const mockError = new Error('Registration failed');
      mockClient.auth.signUp.mockResolvedValueOnce({
        data: null,
        error: mockError,
      });

      await expect(
        authService.register('test@example.com', 'password123')
      ).rejects.toThrow(mockError);

      expect(logger.error).toHaveBeenCalledWith(mockError);
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const result = await authService.login('test@example.com', 'password123');

      expect(result.data.user).toEqual(mockUser);
      expect(result.data.session).toEqual(mockSession);
      expect(mockClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(logger.info).toHaveBeenCalledWith('User logged in successfully', {
        email: 'test@example.com',
      });
    });

    it('should handle login error', async () => {
      const mockError = new Error('Login failed');
      mockClient.auth.signInWithPassword.mockResolvedValueOnce({
        data: null,
        error: mockError,
      });

      await expect(
        authService.login('test@example.com', 'password123')
      ).rejects.toThrow(mockError);

      expect(logger.error).toHaveBeenCalledWith(mockError);
    });
  });

  describe('resetPassword', () => {
    it('should send reset password email successfully', async () => {
      const result = await authService.resetPassword('test@example.com');

      expect(result.error).toBeNull();
      expect(mockClient.auth.resetPasswordForEmail).toHaveBeenCalledWith('test@example.com', {
        redirectTo: 'http://localhost/reset-password',
      });
      expect(logger.info).toHaveBeenCalledWith('Password reset email sent', {
        email: 'test@example.com',
      });
    });

    it('should handle reset password error', async () => {
      const mockError = new Error('Reset password failed');
      mockClient.auth.resetPasswordForEmail.mockResolvedValueOnce({
        data: null,
        error: mockError,
      });

      await expect(
        authService.resetPassword('test@example.com')
      ).rejects.toThrow(mockError);

      expect(logger.error).toHaveBeenCalledWith(mockError);
    });
  });

  describe('updatePassword', () => {
    it('should update password successfully', async () => {
      const result = await authService.updatePassword('newpassword123');

      expect(result.data.user).toEqual(mockUser);
      expect(result.data.session).toEqual(mockSession);
      expect(mockClient.auth.updateUser).toHaveBeenCalledWith({
        password: 'newpassword123',
      });
      expect(logger.info).toHaveBeenCalledWith('Password updated successfully');
    });

    it('should handle update password error', async () => {
      const mockError = new Error('Update password failed');
      mockClient.auth.updateUser.mockResolvedValueOnce({
        data: { user: null },
        error: mockError,
      });

      await expect(
        authService.updatePassword('newpassword123')
      ).rejects.toThrow(mockError);

      expect(logger.error).toHaveBeenCalledWith(mockError);
    });
  });

  describe('signOut', () => {
    it('should sign out successfully', async () => {
      const result = await authService.signOut();

      expect(result.error).toBeNull();
      expect(mockClient.auth.signOut).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('User signed out successfully');
    });

    it('should handle sign out error', async () => {
      const mockError = new Error('Sign out failed');
      mockClient.auth.signOut.mockResolvedValueOnce({
        error: mockError,
      });

      await expect(authService.signOut()).rejects.toThrow(mockError);

      expect(logger.error).toHaveBeenCalledWith(mockError);
    });
  });

  describe('getUser', () => {
    it('should get user successfully', async () => {
      const result = await authService.getUser();

      expect(result.data.user).toEqual(mockUser);
      expect(result.data.session).toEqual(mockSession);
      expect(mockClient.auth.getUser).toHaveBeenCalled();
      expect(mockClient.auth.getSession).toHaveBeenCalled();
    });

    it('should handle get user error', async () => {
      const mockError = new Error('Get user failed');
      mockClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: mockError,
      });

      await expect(authService.getUser()).rejects.toThrow(mockError);

      expect(logger.error).toHaveBeenCalledWith(mockError);
    });
  });
}); 