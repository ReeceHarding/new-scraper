import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseUserProfileService, UserProfile } from '../services/user-profile';
import logger from '../services/server-logger';

jest.mock('../services/server-logger');

describe('UserProfileService', () => {
  let userProfileService: SupabaseUserProfileService;
  let mockSupabaseClient: jest.Mocked<SupabaseClient>;

  beforeEach(() => {
    const mockSingle = jest.fn();
    const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
    const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
    const mockDelete = jest.fn().mockReturnValue({ eq: mockEq });

    mockSupabaseClient = {
      from: jest.fn().mockImplementation(() => ({
        select: mockSelect,
        update: mockUpdate,
        insert: mockInsert,
        delete: mockDelete,
      })),
    } as unknown as jest.Mocked<SupabaseClient>;

    userProfileService = new SupabaseUserProfileService(mockSupabaseClient);
    (logger.error as jest.Mock).mockClear();
  });

  describe('getProfile', () => {
    it('should return user profile when found', async () => {
      const mockProfile: UserProfile = {
        id: 'user123',
        email: 'test@example.com',
        role: 'user',
        status: 'active',
        ui_settings: {},
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockSingle = jest.fn().mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      });

      const mockChain = {
        select: () => ({
          eq: () => ({
            single: mockSingle
          })
        })
      };

      (mockSupabaseClient.from as jest.Mock).mockImplementation(() => mockChain);

      const result = await userProfileService.getProfile('user123');
      expect(result).toEqual(mockProfile);
    });

    it('should throw error when profile fetch fails', async () => {
      const mockError = new Error('Failed to fetch profile');
      const mockSingle = jest.fn().mockResolvedValueOnce({
        data: null,
        error: mockError,
      });

      const mockChain = {
        select: () => ({
          eq: () => ({
            single: mockSingle
          })
        })
      };

      (mockSupabaseClient.from as jest.Mock).mockImplementation(() => mockChain);

      await expect(userProfileService.getProfile('user123')).rejects.toThrow(mockError);
    });
  });

  describe('updateProfile', () => {
    it('should update and return user profile', async () => {
      const updateData = {
        display_name: 'New Name',
      };

      const mockUpdatedProfile: UserProfile = {
        id: 'user123',
        email: 'test@example.com',
        display_name: 'New Name',
        role: 'user',
        status: 'active',
        ui_settings: {},
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockSingle = jest.fn().mockResolvedValueOnce({
        data: mockUpdatedProfile,
        error: null,
      });

      const mockChain = {
        update: () => ({
          eq: () => ({
            select: () => ({
              single: mockSingle
            })
          })
        })
      };

      (mockSupabaseClient.from as jest.Mock).mockImplementation(() => mockChain);

      const result = await userProfileService.updateProfile('user123', updateData);
      expect(result).toEqual(mockUpdatedProfile);
    });

    it('should throw error when update fails', async () => {
      const mockError = new Error('Failed to update profile');
      const mockSingle = jest.fn().mockResolvedValueOnce({
        data: null,
        error: mockError,
      });

      const mockChain = {
        update: () => ({
          eq: () => ({
            select: () => ({
              single: mockSingle
            })
          })
        })
      };

      (mockSupabaseClient.from as jest.Mock).mockImplementation(() => mockChain);

      await expect(userProfileService.updateProfile('user123', {})).rejects.toThrow(mockError);
    });
  });

  describe('createProfile', () => {
    it('should create and return user profile', async () => {
      const createData = {
        display_name: 'New User',
      };

      const mockCreatedProfile: UserProfile = {
        id: 'user123',
        email: 'test@example.com',
        display_name: 'New User',
        role: 'user',
        status: 'active',
        ui_settings: {},
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockSingle = jest.fn().mockResolvedValueOnce({
        data: mockCreatedProfile,
        error: null,
      });

      const mockChain = {
        insert: () => ({
          select: () => ({
            single: mockSingle
          })
        })
      };

      (mockSupabaseClient.from as jest.Mock).mockImplementation(() => mockChain);

      const result = await userProfileService.createProfile('user123', createData);
      expect(result).toEqual(mockCreatedProfile);
    });

    it('should throw error when creation fails', async () => {
      const mockError = new Error('Failed to create profile');
      const mockSingle = jest.fn().mockResolvedValueOnce({
        data: null,
        error: mockError,
      });

      const mockChain = {
        insert: () => ({
          select: () => ({
            single: mockSingle
          })
        })
      };

      (mockSupabaseClient.from as jest.Mock).mockImplementation(() => mockChain);

      await expect(userProfileService.createProfile('user123', {})).rejects.toThrow(mockError);
    });
  });

  describe('deleteProfile', () => {
    it('should delete user profile successfully', async () => {
      const mockDelete = jest.fn().mockResolvedValueOnce({
        error: null,
      });

      const mockChain = {
        delete: () => ({
          eq: () => mockDelete
        })
      };

      (mockSupabaseClient.from as jest.Mock).mockImplementation(() => mockChain);

      await expect(userProfileService.deleteProfile('user123')).resolves.not.toThrow();
    });

    it('should throw error when deletion fails', async () => {
      const mockError = new Error('Failed to delete profile');
      const mockDelete = jest.fn().mockResolvedValueOnce({
        data: null,
        error: mockError
      });

      const mockChain = {
        delete: () => ({
          eq: () => mockDelete()
        })
      };

      (mockSupabaseClient.from as jest.Mock).mockImplementation(() => mockChain);

      await expect(userProfileService.deleteProfile('user123')).rejects.toThrow(mockError);
    });
  });

  describe('error handling', () => {
    it('handles non-Error objects in catch blocks', async () => {
      const mockError = { message: 'Failed to fetch profile' };
      const mockSingle = jest.fn().mockResolvedValueOnce({
        data: null,
        error: mockError
      });

      const mockChain = {
        select: () => ({
          eq: () => ({
            single: mockSingle
          })
        })
      };

      (mockSupabaseClient.from as jest.Mock).mockImplementation(() => mockChain);

      await expect(userProfileService.getProfile('123')).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        String(mockError.message),
        expect.any(Error),
        {}
      );
    });

    it('handles database errors in profile creation', async () => {
      const mockError = new Error('Database error');
      const mockSingle = jest.fn().mockRejectedValueOnce(mockError);

      const mockChain = {
        insert: () => ({
          select: () => ({
            single: mockSingle
          })
        })
      };

      (mockSupabaseClient.from as jest.Mock).mockImplementation(() => mockChain);

      await expect(userProfileService.createProfile('123', {})).rejects.toThrow(mockError);
      expect(logger.error).toHaveBeenCalledWith(
        mockError.message,
        mockError,
        {}
      );
    });

    it('handles database errors in profile update', async () => {
      const mockError = new Error('Update error');
      const mockSingle = jest.fn().mockRejectedValueOnce(mockError);

      const mockChain = {
        update: () => ({
          eq: () => ({
            select: () => ({
              single: mockSingle
            })
          })
        })
      };

      (mockSupabaseClient.from as jest.Mock).mockImplementation(() => mockChain);

      await expect(userProfileService.updateProfile('123', {})).rejects.toThrow(mockError);
      expect(logger.error).toHaveBeenCalledWith(
        mockError.message,
        mockError,
        {}
      );
    });

    it('handles database errors in profile deletion', async () => {
      const mockError = new Error('Deletion error');
      const mockDelete = jest.fn().mockResolvedValueOnce({
        data: null,
        error: mockError
      });

      const mockChain = {
        delete: () => ({
          eq: () => mockDelete()
        })
      };

      (mockSupabaseClient.from as jest.Mock).mockImplementation(() => mockChain);

      await expect(userProfileService.deleteProfile('123')).rejects.toThrow(mockError);
      expect(logger.error).toHaveBeenCalledWith(
        mockError.message,
        mockError,
        {}
      );
    });
  });
}); 