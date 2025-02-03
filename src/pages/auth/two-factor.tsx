import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuthContext } from '@/contexts/AuthContext';
import logger from '@/services/client-logger';
import { QRCodeSVG } from 'qrcode.react';
import { TwoFactorService, TwoFactorMethod } from '@/services/auth/two-factor';

const twoFactorService = new TwoFactorService();

export default function TwoFactorSettings() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [methods, setMethods] = useState<TwoFactorMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setupStep, setSetupStep] = useState<'initial' | 'qr' | 'verify'>('initial');
  const [setupType, setSetupType] = useState<'totp' | 'sms' | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [qrData, setQrData] = useState<{ secret: string; qrCode: string; backupCodes: string[]; methodId: string } | null>(null);
  const [currentMethodId, setCurrentMethodId] = useState<string | null>(null);

  const loadMethods = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      const methods = await twoFactorService.getMethods(user.id);
      setMethods(methods);
    } catch (err) {
      logger.error('Failed to load 2FA methods', err);
      setError('Failed to load 2FA methods. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    loadMethods();
  }, [user, router, loadMethods]);

  const startSetup = (type: 'totp' | 'sms') => {
    setSetupType(type);
    setSetupStep('initial');
    setError(null);
    setDeviceName('');
    setPhoneNumber('');
    setVerificationCode('');
  };

  const setupTOTP = async () => {
    try {
      if (!deviceName.trim()) {
        setError('Device name is required');
        return;
      }

      setLoading(true);
      setError(null);
      const data = await twoFactorService.setupTOTP(user!.id, deviceName);
      setQrData(data);
      setCurrentMethodId(data.methodId);
      setSetupStep('qr');
    } catch (err) {
      logger.error('Failed to setup TOTP', err);
      setError('Failed to setup authenticator. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const setupSMS = async () => {
    try {
      if (!phoneNumber.trim()) {
        setError('Phone number is required');
        return;
      }

      setLoading(true);
      setError(null);
      const { methodId } = await twoFactorService.setupSMS(user!.id, phoneNumber);
      setCurrentMethodId(methodId);
      await twoFactorService.createChallenge(user!.id, methodId);
      setSetupStep('verify');
    } catch (err) {
      logger.error('Failed to setup SMS', err);
      setError('Failed to setup SMS verification. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifySetup = async () => {
    try {
      if (!verificationCode.trim()) {
        setError('Verification code is required');
        return;
      }

      if (!currentMethodId) {
        setError('No active setup in progress');
        return;
      }

      setLoading(true);
      setError(null);

      let success = false;

      if (setupType === 'totp' && qrData) {
        success = await twoFactorService.verifyTOTP(user!.id, currentMethodId, verificationCode);
      } else if (setupType === 'sms') {
        success = await twoFactorService.verifyChallenge(user!.id, currentMethodId, verificationCode);
      }

      if (success) {
        await loadMethods();
        setSetupStep('initial');
        setSetupType(null);
        setQrData(null);
        setVerificationCode('');
        setDeviceName('');
        setPhoneNumber('');
        setCurrentMethodId(null);
      } else {
        setError('Invalid verification code. Please try again.');
      }
    } catch (err) {
      logger.error('Failed to verify setup', err);
      setError('Failed to verify setup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const deleteMethod = async (methodId: string) => {
    try {
      if (!methodId) {
        setError('Invalid method ID');
        return;
      }

      setLoading(true);
      setError(null);
      await twoFactorService.deleteMethod(user!.id, methodId);
      setMethods(methods.filter(m => m.id !== methodId));
    } catch (err) {
      logger.error('Failed to delete 2FA method', err);
      setError('Failed to delete 2FA method. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null; // Don't render anything while redirecting
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div 
          role="status"
          className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"
          aria-label="Loading..."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900">Two-Factor Authentication</h2>
            
            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4" role="alert">
                <p className="text-sm text-red-600" data-testid="error-message">{error}</p>
              </div>
            )}

            {/* Current Methods */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-900">Active Methods</h3>
              {methods?.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">No two-factor authentication methods configured.</p>
              ) : (
                <ul className="mt-2 divide-y divide-gray-200">
                  {methods?.map((method) => (
                    <li key={method.id} className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {method.type === 'totp' ? 'Authenticator App' : 'SMS'}
                          </p>
                          <p className="text-sm text-gray-500">{method.identifier}</p>
                        </div>
                        <button
                          onClick={() => deleteMethod(method.id)}
                          className="ml-4 text-sm font-medium text-red-600 hover:text-red-500"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Setup New Method */}
            {setupStep === 'initial' && !setupType && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-900">Add New Method</h3>
                <div className="mt-4 space-y-4">
                  <button
                    onClick={() => startSetup('totp')}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Set up authenticator app
                  </button>
                  <button
                    onClick={() => startSetup('sms')}
                    className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Set up SMS verification
                  </button>
                </div>
              </div>
            )}

            {/* TOTP Setup */}
            {setupType === 'totp' && setupStep === 'initial' && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-900">Set up authenticator app</h3>
                <div className="mt-4">
                  <label htmlFor="device-name" className="block text-sm font-medium text-gray-700">
                    Device Name
                  </label>
                  <input
                    type="text"
                    id="device-name"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="e.g. iPhone 12"
                    aria-label="Device Name"
                  />
                  <button
                    onClick={setupTOTP}
                    disabled={!deviceName.trim()}
                    className="mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* QR Code Display */}
            {setupType === 'totp' && setupStep === 'qr' && qrData && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-900">Scan QR Code</h3>
                <div className="mt-4">
                  <div className="flex justify-center">
                    <QRCodeSVG value={qrData.qrCode} size={200} />
                  </div>
                  <div className="mt-4">
                    <p className="text-sm text-gray-500">
                      Scan this QR code with your authenticator app, then enter the verification code below.
                    </p>
                    <div className="mt-4">
                      <label htmlFor="verification-code" className="block text-sm font-medium text-gray-700">
                        Verification Code
                      </label>
                      <input
                        type="text"
                        id="verification-code"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="Enter 6-digit code"
                      />
                      <button
                        onClick={verifySetup}
                        disabled={!verificationCode.trim()}
                        className="mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300"
                      >
                        Verify
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SMS Setup */}
            {setupType === 'sms' && setupStep === 'initial' && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-900">Set up SMS verification</h3>
                <div className="mt-4">
                  <label htmlFor="phone-number" className="block text-sm font-medium text-gray-700">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone-number"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter phone number"
                  />
                  <button
                    onClick={setupSMS}
                    disabled={!phoneNumber.trim()}
                    className="mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300"
                  >
                    Send Code
                  </button>
                </div>
              </div>
            )}

            {/* SMS Verification */}
            {setupType === 'sms' && setupStep === 'verify' && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-900">Verify Phone Number</h3>
                <div className="mt-4">
                  <label htmlFor="verification-code" className="block text-sm font-medium text-gray-700">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    id="verification-code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter 6-digit code"
                  />
                  <button
                    onClick={verifySetup}
                    disabled={!verificationCode.trim()}
                    className="mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300"
                  >
                    Verify
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 