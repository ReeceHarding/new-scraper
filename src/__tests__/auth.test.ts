import { AuthService, SupabaseAuthService } from '@/services/auth';
import { SupabaseClient, User, Session, AuthError, AuthTokenResponse } from '@supabase/supabase-js';
import { jest } from '@jest/globals';

type MockResponse<T> = { data: T | null; error: Error | null };
type MockCallback<T> = (response: MockResponse<T>) => any;

// Create a mock query builder that properly returns promises
const createMockQueryBuilder = () => {
  const builder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    // Return a promise by default
    then: jest.fn().mockImplementation((...args: any[]) => {
      const callback = args[0] as MockCallback<any>;
      return Promise.resolve(callback({ data: [], error: null }));
    })
  };
  return builder;
};

// Mock window.location
const mockWindow = {
  location: {
    origin: 'http://localhost',
  },
};
(global as any).window = mockWindow;

// Mock logger
jest.mock('../services/client-logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn().mockImplementation(() => Promise.resolve()),
    info: jest.fn().mockImplementation(() => Promise.resolve()),
    warn: jest.fn().mockImplementation(() => Promise.resolve()),
    debug: jest.fn().mockImplementation(() => Promise.resolve()),
    logPerformance: jest.fn().mockImplementation(() => Promise.resolve()),
    setTestMode: jest.fn().mockImplementation(() => Promise.resolve()),
    clearErrorCount: jest.fn().mockImplementation(() => Promise.resolve()),
    setContext: jest.fn().mockImplementation(() => Promise.resolve())
  }
}));

describe('AuthService', () => {
  let authService: AuthService;
  let mockClient: jest.Mocked<SupabaseClient>;
  
  const mockUser: User = {
    id: '123',
    email: 'test@example.com',
    role: 'authenticated',
    aud: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString()
  };

  const mockSession: Session = {
    access_token: 'mock-token',
    refresh_token: 'mock-refresh-token',
    expires_at: Date.now() + 3600000,
    expires_in: 3600,
    token_type: 'bearer',
    user: mockUser
  };

  const createMockAuthError = (message: string): AuthError => {
    const error = new Error(message) as AuthError;
    Object.setPrototypeOf(error, AuthError.prototype);
    return Object.assign(error, {
      name: 'AuthError',
      status: 400,
      code: 'auth/error',
      __isAuthError: true
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockClient = {
      auth: {
        signUp: jest.fn(),
        signInWithPassword: jest.fn(),
        getUser: jest.fn(),
        getSession: jest.fn(),
        signOut: jest.fn(),
        resetPasswordForEmail: jest.fn(),
        updateUser: jest.fn(),
        admin: {
          deleteUser: jest.fn()
        }
      },
      from: jest.fn().mockImplementation(() => createMockQueryBuilder())
    } as unknown as jest.Mocked<SupabaseClient>;

    authService = new SupabaseAuthService(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should validate password', async () => {
      const queryBuilder = mockClient.from('profiles');
      (queryBuilder as any).then = jest.fn().mockImplementation((...args: any[]) => {
        const callback = args[0] as MockCallback<any>;
        return Promise.resolve(callback({ data: [], error: null }));
      });

      await expect(
        authService.register('test@example.com', 'weak')
      ).rejects.toThrow(/Password must be at least 8 characters/);
    }, 5000);

    it('should check for existing email', async () => {
      mockClient.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null
      });

      await expect(
        authService.register('test@example.com', 'Test123!@#')
      ).rejects.toThrow('Email already registered');
    }, 5000);

    it('should handle registration error', async () => {
      mockClient.auth.resetPasswordForEmail.mockRejectedValue({
        status: 500,
        message: 'Internal server error'
      });

      await expect(
        authService.register('test@example.com', 'Test123!@#')
      ).rejects.toThrow('Registration failed');
    }, 5000);

    it('should handle profile creation error', async () => {
      mockClient.auth.resetPasswordForEmail.mockRejectedValue({
        status: 422,
        message: 'Email not found'
      });

      mockClient.auth.signUp.mockResolvedValue({
        data: {
          user: mockUser,
          session: mockSession
        },
        error: null
      } as AuthTokenResponse);

      // Mock the profiles table operations
      const mockProfilesTable = {
        insert: jest.fn().mockReturnValue({
          then: jest.fn().mockImplementation((callback: any) => 
            Promise.resolve(callback({
              data: null,
              error: createMockAuthError('Profile creation failed')
            }))
          )
        })
      };

      (mockClient.from as jest.Mock).mockImplementation(() => mockProfilesTable);

      await expect(
        authService.register('test@example.com', 'Test123!@#')
      ).rejects.toThrow('Registration failed');
    }, 5000);

    it('should register a new user successfully', async () => {
      mockClient.auth.resetPasswordForEmail.mockRejectedValue({
        status: 422,
        message: 'Email not found'
      });

      mockClient.auth.signUp.mockResolvedValue({
        data: {
          user: mockUser,
          session: mockSession
        },
        error: null
      } as AuthTokenResponse);

      const queryBuilder = mockClient.from('profiles');
      (queryBuilder as any).then = jest.fn().mockImplementation((...args: any[]) => {
        const callback = args[0] as MockCallback<any>;
        return Promise.resolve(callback({ data: { id: mockUser.id }, error: null }));
      });

      const result = await authService.register('test@example.com', 'Test123!@#');
      expect(result).toEqual({
        data: {
          user: mockUser,
          session: mockSession
        },
        error: null
      });
    }, 5000);
  });

  describe('login', () => {
    it('should login successfully', async () => {
      mockClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: mockUser,
          session: mockSession
        },
        error: null
      } as AuthTokenResponse);

      const result = await authService.login('test@example.com', 'Test123!@#');
      expect(result).toEqual({
        data: {
          user: mockUser,
          session: mockSession
        },
        error: null
      });
    }, 5000);

    it('should handle login error', async () => {
      mockClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: createMockAuthError('Login failed')
      } as AuthTokenResponse);

      await expect(
        authService.login('test@example.com', 'Test123!@#')
      ).rejects.toThrow('Login failed');
    }, 5000);
  });

  describe('getUser', () => {
    it('should return current user successfully', async () => {
      mockClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      mockClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const result = await authService.getUser();
      expect(result).toEqual({
        data: {
          user: mockUser,
          session: mockSession
        },
        error: null
      });
    }, 5000);

    it('should handle get user error', async () => {
      mockClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: createMockAuthError('Get user failed')
      });

      await expect(authService.getUser()).rejects.toThrow('Get user failed');
    }, 5000);
  });
}); 