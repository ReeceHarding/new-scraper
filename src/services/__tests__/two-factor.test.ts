import { TwoFactorService } from '../auth/two-factor';
import { createClient } from '@supabase/supabase-js';
import { authenticator } from 'otplib';

interface MockChain {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  eq: jest.Mock;
  is: jest.Mock;
  gt: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  single: jest.Mock;
}

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => {
  let mockData = {
    methodSecret: 'test-secret',
    backupCodes: ['TEST1', 'TEST2'],
    challenges: [] as any[],
    currentTime: Date.now(),
  };

  // Expose methods to manipulate mock data for tests
  (global as any).__mockData = {
    advanceTime: (ms: number) => {
      mockData.currentTime += ms;
    },
    resetMockData: () => {
      mockData = {
        methodSecret: 'test-secret',
        backupCodes: ['TEST1', 'TEST2'],
        challenges: [],
        currentTime: Date.now(),
      };
    }
  };

  return {
    createClient: jest.fn(() => {
      const mockChain: MockChain = {
        select: jest.fn(() => mockChain),
        insert: jest.fn((data?: any) => {
          if (data) {
            const challenge = { 
              ...data, 
              id: `challenge-${Date.now()}`,
              created_at: new Date(mockData.currentTime).toISOString()
            };
            mockData.challenges.push(challenge);
          }
          return mockChain;
        }),
        update: jest.fn((data: { backup_codes?: string[], verified_at?: string }) => {
          if (data.backup_codes) {
            mockData.backupCodes = data.backup_codes;
          }
          if (data.verified_at && mockData.challenges.length > 0) {
            mockData.challenges[mockData.challenges.length - 1].verified_at = data.verified_at;
          }
          return mockChain;
        }),
        delete: jest.fn(() => mockChain),
        eq: jest.fn(() => mockChain),
        is: jest.fn(() => mockChain),
        gt: jest.fn(() => {
          // Filter challenges based on expiration
          if (mockChain.select.mock.calls[0][0] === '*') {
            mockData.challenges = mockData.challenges.filter(c => 
              new Date(c.expires_at).getTime() > mockData.currentTime
            );
          }
          return mockChain;
        }),
        order: jest.fn(() => mockChain),
        limit: jest.fn(() => {
          if (mockChain.select.mock.calls[0][0] === '*') {
            return {
              data: mockData.challenges,
              error: null
            };
          }
          return mockChain;
        }),
        single: jest.fn(() => ({
          data: { 
            id: 'method-id', 
            secret: mockData.methodSecret,
            backup_codes: mockData.backupCodes,
            verified_at: null,
            expires_at: new Date(mockData.currentTime + 5 * 60 * 1000).toISOString()
          },
          error: null
        }))
      };

      return {
        from: jest.fn(() => mockChain)
      };
    })
  };
});

describe('TwoFactorService', () => {
  let service: TwoFactorService;
  const mockClient = createClient('test-url', 'test-key');

  beforeEach(() => {
    service = new TwoFactorService(mockClient);
    (global as any).__mockData.resetMockData();
  });

  describe('setupTOTP', () => {
    it('should setup TOTP successfully', async () => {
      const result = await service.setupTOTP('user-id', 'test-device');
      
      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('qrCode');
      expect(result).toHaveProperty('backupCodes');
      expect(result.backupCodes).toHaveLength(10);
    });
  });

  describe('verifyTOTP', () => {
    it('should verify valid TOTP code', async () => {
      // Generate a valid TOTP code
      const code = authenticator.generate('test-secret');
      
      const result = await service.verifyTOTP('user-id', 'method-id', code);
      
      expect(result).toBe(true);
    });

    it('should reject invalid TOTP code', async () => {
      const result = await service.verifyTOTP('user-id', 'method-id', '000000');
      
      expect(result).toBe(false);
    });

    it('should block after too many attempts', async () => {
      const testUserId = `test-user-${Date.now()}`;
      const attempts = Array(6).fill('000000');
      
      for (let i = 0; i < 5; i++) {
        try {
          await service.verifyTOTP(testUserId, 'method-id', attempts[i]);
        } catch {
          // Ignore errors from previous attempts
        }
      }
      
      await expect(
        service.verifyTOTP(testUserId, 'method-id', attempts[5])
      ).rejects.toThrow('Too many verification attempts');
    });
  });

  describe('verifyBackupCode', () => {
    it('should verify valid backup code', async () => {
      const result = await service.verifyBackupCode('user-id', 'method-id', 'TEST1');
      
      expect(result).toBe(true);
    });

    it('should reject invalid backup code', async () => {
      const result = await service.verifyBackupCode('user-id', 'method-id', 'INVALID');
      
      expect(result).toBe(false);
    });

    it('should remove used backup code', async () => {
      await service.verifyBackupCode('user-id', 'method-id', 'TEST1');
      
      const secondAttempt = await service.verifyBackupCode('user-id', 'method-id', 'TEST1');
      
      expect(secondAttempt).toBe(false);
    });
  });

  describe('createChallenge', () => {
    it('should create SMS challenge', async () => {
      const code = await service.createChallenge('user-id', 'method-id');
      
      expect(code).toMatch(/^\d{6}$/);
    });
  });

  describe('verifyChallenge', () => {
    it('should verify valid challenge code', async () => {
      const code = await service.createChallenge('user-id', 'method-id');
      const result = await service.verifyChallenge('user-id', 'method-id', code);
      
      expect(result).toBe(true);
    });

    it('should reject expired challenge', async () => {
      const code = await service.createChallenge('user-id', 'method-id');
      
      // Fast forward time by 6 minutes
      (global as any).__mockData.advanceTime(6 * 60 * 1000);
      
      const result = await service.verifyChallenge('user-id', 'method-id', code);
      
      expect(result).toBe(false);
    });
  });

  describe('getMethods', () => {
    it('should return user\'s 2FA methods', async () => {
      const methods = await service.getMethods('user-id');
      
      expect(Array.isArray(methods)).toBe(true);
    });
  });

  describe('deleteMethod', () => {
    it('should delete 2FA method', async () => {
      await expect(
        service.deleteMethod('user-id', 'method-id')
      ).resolves.not.toThrow();
    });
  });
}); 