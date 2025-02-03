import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import TwoFactorSettings from '@/pages/auth/two-factor';
import { TwoFactorService } from '@/services/auth/two-factor';
import serverLogger from '@/services/server-logger';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock the TwoFactorService
let mockMethods: any = null;

jest.mock('@/services/auth/two-factor', () => ({
  TwoFactorService: jest.fn().mockImplementation(() => ({
    getMethods: jest.fn().mockImplementation((userId) => {
      if (mockMethods) return Promise.resolve(mockMethods);
      return Promise.resolve([]);
    }),
    setupTOTP: jest.fn().mockResolvedValue({
      secret: 'test-secret',
      qrCode: 'test-qr-code',
      backupCodes: ['TEST1', 'TEST2'],
      methodId: 'test-method-id',
    }),
    setupSMS: jest.fn().mockResolvedValue({ methodId: 'test-method-id' }),
    verifyTOTP: jest.fn().mockResolvedValue(true),
    verifyChallenge: jest.fn().mockResolvedValue(true),
    createChallenge: jest.fn().mockResolvedValue('123456'),
    deleteMethod: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock the client logger
jest.mock('@/services/client-logger', () => ({
  error: jest.fn(),
}));

// Mock the AuthContext hook
jest.mock('@/contexts/AuthContext', () => ({
  useAuthContext: jest.fn(),
}));

describe('TwoFactorSettings', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
  };

  const mockRouter = {
    push: jest.fn(),
  };

  const mockAuthContext = {
    user: mockUser,
    loading: false,
    error: null,
    signIn: jest.fn(),
    signOut: jest.fn(),
    signUp: jest.fn(),
  };

  beforeEach(async () => {
    mockMethods = null;
    jest.clearAllMocks();
    await serverLogger.setTestMode(true);
    (useAuthContext as jest.Mock).mockReturnValue(mockAuthContext);
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  afterEach(async () => {
    await serverLogger.clearLogContent();
  });

  it('redirects to login if user is not authenticated', () => {
    (useAuthContext as jest.Mock).mockReturnValue({ ...mockAuthContext, user: null });
    render(<TwoFactorSettings />);
    expect(mockRouter.push).toHaveBeenCalledWith('/auth/login');
  });

  it('displays loading state initially', () => {
    render(<TwoFactorSettings />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('displays no methods message when user has no 2FA methods', async () => {
    render(<TwoFactorSettings />);

    await waitFor(() => {
      expect(screen.getByText('No two-factor authentication methods configured.')).toBeInTheDocument();
    });
  });

  describe('Method Management', () => {
    it('allows deleting a 2FA method', async () => {
      mockMethods = [{
        id: 'method-1',
        user_id: 'test-user-id',
        type: 'totp',
        identifier: 'Test Device',
        secret: 'test-secret',
        backup_codes: ['TEST1', 'TEST2'],
        is_primary: true,
        is_enabled: true,
        last_used_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }];

      const mockTwoFactorService = {
        getMethods: jest.fn()
          .mockResolvedValueOnce(mockMethods)  // First call returns the method
          .mockResolvedValueOnce([]),          // Second call after deletion returns empty array
        deleteMethod: jest.fn().mockResolvedValue(undefined),
      };
      (TwoFactorService as jest.Mock).mockImplementation(() => mockTwoFactorService);

      render(<TwoFactorSettings />);
      
      // Wait for loading to finish and methods to appear
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.getByText('Authenticator App')).toBeInTheDocument();
        expect(screen.getByText('Test Device')).toBeInTheDocument();
      });

      // Click the Remove button
      const removeButton = screen.getByText('Remove');
      fireEvent.click(removeButton);
      
      // Wait for loading state to appear and disappear
      await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.queryByText('Test Device')).not.toBeInTheDocument();
      });
    });

    it('displays error message on delete failure', async () => {
      mockMethods = [{
        id: 'method-1',
        user_id: 'test-user-id',
        type: 'totp',
        identifier: 'Test Device',
        secret: 'test-secret',
        backup_codes: ['TEST1', 'TEST2'],
        is_primary: true,
        is_enabled: true,
        last_used_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }];

      const mockTwoFactorService = {
        getMethods: jest.fn().mockResolvedValue(mockMethods),
        deleteMethod: jest.fn().mockRejectedValue(new Error('Delete failed')),
      };
      (TwoFactorService as jest.Mock).mockImplementation(() => mockTwoFactorService);

      render(<TwoFactorSettings />);
      
      // Wait for loading to finish and methods to appear
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.getByText('Authenticator App')).toBeInTheDocument();
        expect(screen.getByText('Test Device')).toBeInTheDocument();
      });

      // Click the Remove button
      const removeButton = screen.getByText('Remove');
      fireEvent.click(removeButton);
      
      // Wait for loading state to appear and disappear
      await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
      await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());

      // Wait for error message to appear
      const errorMessage = await screen.findByRole('alert');
      expect(errorMessage).toBeInTheDocument();
      expect(screen.getByText('Failed to delete 2FA method. Please try again.')).toBeInTheDocument();
    });
  });

  describe('TOTP Setup', () => {
    it('allows setting up TOTP authentication', async () => {
      const mockTwoFactorService = {
        getMethods: jest.fn().mockResolvedValue([]),
        setupTOTP: jest.fn().mockResolvedValue({
          secret: 'test-secret',
          qrCode: 'test-qr-code',
          backupCodes: ['TEST1', 'TEST2'],
          methodId: 'test-method-id',
        }),
        verifyTOTP: jest.fn().mockResolvedValue(true),
        verifyChallenge: jest.fn().mockResolvedValue(true),
        createChallenge: jest.fn().mockResolvedValue('123456'),
        deleteMethod: jest.fn().mockResolvedValue(undefined),
      };
      (TwoFactorService as jest.Mock).mockImplementation(() => mockTwoFactorService);

      render(<TwoFactorSettings />);

      // Wait for loading to finish
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      // Click setup button
      const setupButton = screen.getByText('Set up authenticator app');
      fireEvent.click(setupButton);

      // Enter device name
      const deviceNameInput = screen.getByLabelText('Device Name');
      fireEvent.change(deviceNameInput, { target: { value: 'Test Device' } });
      
      // Click continue
      const continueButton = screen.getByText('Continue');
      fireEvent.click(continueButton);

      // Wait for loading state to appear and disappear
      await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.getByText('Scan QR Code')).toBeInTheDocument();
      });

      // Enter verification code
      const codeInput = screen.getByPlaceholderText('Enter 6-digit code');
      fireEvent.change(codeInput, { target: { value: '123456' } });
      
      // Click verify
      const verifyButton = screen.getByRole('button', { name: 'Verify' });
      fireEvent.click(verifyButton);

      // Wait for loading state to appear and disappear
      await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
      });
    });

    it('displays error message on TOTP setup failure', async () => {
      const mockTwoFactorService = {
        getMethods: jest.fn().mockResolvedValue([]),
        setupTOTP: jest.fn().mockResolvedValue({
          secret: 'test-secret',
          qrCode: 'test-qr-code',
          backupCodes: ['TEST1', 'TEST2'],
          methodId: 'test-method-id',
        }),
        verifyTOTP: jest.fn().mockRejectedValue(new Error('Setup failed')),
        verifyChallenge: jest.fn().mockResolvedValue(true),
        createChallenge: jest.fn().mockResolvedValue('123456'),
        deleteMethod: jest.fn().mockResolvedValue(undefined),
      };
      (TwoFactorService as jest.Mock).mockImplementation(() => mockTwoFactorService);

      render(<TwoFactorSettings />);

      // Wait for loading to finish
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      // Click setup button
      const setupButton = screen.getByText('Set up authenticator app');
      fireEvent.click(setupButton);

      // Enter device name
      const deviceNameInput = screen.getByLabelText('Device Name');
      fireEvent.change(deviceNameInput, { target: { value: 'Test Device' } });
      
      // Click continue
      const continueButton = screen.getByText('Continue');
      fireEvent.click(continueButton);

      // Wait for loading state to appear and disappear
      await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.getByText('Scan QR Code')).toBeInTheDocument();
      });

      // Enter verification code
      const codeInput = screen.getByPlaceholderText('Enter 6-digit code');
      fireEvent.change(codeInput, { target: { value: '123456' } });
      
      // Click verify
      const verifyButton = screen.getByRole('button', { name: 'Verify' });
      fireEvent.click(verifyButton);

      // Wait for loading state to appear and disappear
      await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
      await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());

      // Wait for error message to appear
      const errorMessage = await screen.findByRole('alert');
      expect(errorMessage).toBeInTheDocument();
      expect(screen.getByText('Failed to verify setup. Please try again.')).toBeInTheDocument();
    });
  });

  describe('SMS Setup', () => {
    it('allows setting up SMS verification', async () => {
      const mockTwoFactorService = {
        getMethods: jest.fn().mockResolvedValue([]),
        setupSMS: jest.fn().mockResolvedValue({ methodId: 'test-method-id' }),
        createChallenge: jest.fn().mockResolvedValue('123456'),
        verifyChallenge: jest.fn().mockResolvedValue(true),
        verifyTOTP: jest.fn().mockResolvedValue(true),
        deleteMethod: jest.fn().mockResolvedValue(undefined),
      };
      (TwoFactorService as jest.Mock).mockImplementation(() => mockTwoFactorService);

      render(<TwoFactorSettings />);

      // Wait for loading to finish
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      // Click setup button
      const setupButton = screen.getByText('Set up SMS verification');
      fireEvent.click(setupButton);

      // Enter phone number
      const phoneInput = screen.getByPlaceholderText('Enter phone number');
      fireEvent.change(phoneInput, { target: { value: '+1234567890' } });

      // Click send code
      const sendCodeButton = screen.getByText('Send Code');
      fireEvent.click(sendCodeButton);

      // Wait for loading state to appear and disappear
      await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.getByText('Verify Phone Number')).toBeInTheDocument();
      });

      // Enter verification code
      const codeInput = screen.getByPlaceholderText('Enter 6-digit code');
      fireEvent.change(codeInput, { target: { value: '123456' } });

      // Click verify
      const verifyButton = screen.getByRole('button', { name: 'Verify' });
      fireEvent.click(verifyButton);

      // Wait for loading state to appear and disappear
      await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
      });
    });

    it('displays error message on SMS setup failure', async () => {
      const mockTwoFactorService = {
        getMethods: jest.fn().mockResolvedValue([]),
        setupSMS: jest.fn().mockResolvedValue({ methodId: 'test-method-id' }),
        createChallenge: jest.fn().mockResolvedValue('123456'),
        verifyChallenge: jest.fn().mockRejectedValue(new Error('Setup failed')),
        verifyTOTP: jest.fn().mockResolvedValue(true),
        deleteMethod: jest.fn().mockResolvedValue(undefined),
      };
      (TwoFactorService as jest.Mock).mockImplementation(() => mockTwoFactorService);

      render(<TwoFactorSettings />);

      // Wait for loading to finish
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      // Click setup button
      const setupButton = screen.getByText('Set up SMS verification');
      fireEvent.click(setupButton);

      // Enter phone number
      const phoneInput = screen.getByPlaceholderText('Enter phone number');
      fireEvent.change(phoneInput, { target: { value: '+1234567890' } });

      // Click send code
      const sendCodeButton = screen.getByText('Send Code');
      fireEvent.click(sendCodeButton);

      // Wait for loading state to appear and disappear
      await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.getByText('Verify Phone Number')).toBeInTheDocument();
      });

      // Enter verification code
      const codeInput = screen.getByPlaceholderText('Enter 6-digit code');
      fireEvent.change(codeInput, { target: { value: '123456' } });

      // Click verify
      const verifyButton = screen.getByRole('button', { name: 'Verify' });
      fireEvent.click(verifyButton);

      // Wait for loading state to appear and disappear
      await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
      await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());

      // Wait for error message to appear
      const errorMessage = await screen.findByRole('alert');
      expect(errorMessage).toBeInTheDocument();
      expect(screen.getByText('Failed to verify setup. Please try again.')).toBeInTheDocument();
    });
  });
}); 