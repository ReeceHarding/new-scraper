import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthContext } from '@/contexts/AuthContext';
import logger from '@/services/client-logger';

export default function VerifyEmail() {
  const router = useRouter();
  const { verifyEmail } = useAuthContext();
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verify = async () => {
      try {
        const token = router.query.token as string;
        if (!token) {
          setError('No verification token found');
          setVerifying(false);
          return;
        }

        await verifyEmail(token);
        logger.info('Email verification successful');
        
        // Redirect to dashboard after successful verification
        router.push('/dashboard');
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error('Email verification failed', error);
        setError('Email verification failed. Please try again or contact support.');
        setVerifying(false);
      }
    };

    if (router.isReady) {
      verify();
    }
  }, [router.isReady, router.query, router, verifyEmail]);

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Verifying your email
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Please wait while we verify your email address...
            </p>
          </div>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Verification Failed
            </h2>
            <p className="mt-2 text-sm text-gray-600">{error}</p>
            <button
              onClick={() => router.push('/auth/login')}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
} 