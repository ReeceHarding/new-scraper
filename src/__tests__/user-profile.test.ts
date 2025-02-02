import { SupabaseClient } from '@supabase/supabase-js';
import logger from '../services/server-logger';
import { SupabaseUserProfileService } from '../services/user-profile';

jest.mock('../services/server-logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  setTestMode: jest.fn(),
  clearErrorCount: jest.fn(),
}));

describe('UserProfileService', () => {
  let userProfileService: SupabaseUserProfileService;
  let mockClient: { from: jest.Mock };
  let mockQueryBuilder: {
    select: jest.Mock;
    insert: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    eq: jest.Mock;
    single: jest.Mock;
  };

  beforeEach(() => {
    mockQueryBuilder = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      eq: jest.fn(),
      single: jest.fn(),
    };

    // Set up the chain of mock functions
    mockQueryBuilder.select.mockReturnValue({ eq: mockQueryBuilder.eq, single: mockQueryBuilder.single });
    mockQueryBuilder.eq.mockReturnValue({ single: mockQueryBuilder.single });

    // Set up nested returns for update chain
    mockQueryBuilder.update.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: mockQueryBuilder.single
        })
      })
    });

    // Set up nested returns for insert chain
    mockQueryBuilder.insert.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: mockQueryBuilder.single
      })
    });

    // Set up nested returns for delete chain
    mockQueryBuilder.delete.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: mockQueryBuilder.single
      })
    });

    mockClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    userProfileService = new SupabaseUserProfileService(mockClient as unknown as SupabaseClient);
  });

  describe('getProfile', () => {
    it('should return user profile when found', async () => {
      const mockProfile = {
        id: 'user123',
        email: 'test@example.com',
        role: 'user',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockQueryBuilder.single.mockResolvedValueOnce({ data: mockProfile, error: null });

      const result = await userProfileService.getProfile('user123');
      expect(result).toEqual(mockProfile);
    });

    it('should throw error when profile fetch fails', async () => {
      const mockError = new Error('Failed to fetch profile');
      mockQueryBuilder.single.mockResolvedValueOnce({ data: null, error: mockError });

      await expect(userProfileService.getProfile('user123')).rejects.toThrow(mockError);
    });
  });

  describe('updateProfile', () => {
    it('should update and return user profile', async () => {
      const updateData = {
        display_name: 'Test User',
        full_name: 'Test User Full',
      };

      const mockUpdatedProfile = {
        id: 'user123',
        ...updateData,
        email: 'test@example.com',
        role: 'user',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockQueryBuilder.single.mockResolvedValueOnce({ data: mockUpdatedProfile, error: null });

      const result = await userProfileService.updateProfile('user123', updateData);
      expect(result).toEqual(mockUpdatedProfile);
    });

    it('should throw error when update fails', async () => {
      const mockError = new Error('Failed to update profile');
      mockQueryBuilder.single.mockResolvedValueOnce({ data: null, error: mockError });

      await expect(userProfileService.updateProfile('user123', {})).rejects.toThrow(mockError);
    });
  });

  describe('createProfile', () => {
    it('should create and return user profile', async () => {
      const createData = {
        display_name: 'New User',
        full_name: 'New User Full',
      };

      const mockCreatedProfile = {
        id: 'user123',
        ...createData,
        email: 'test@example.com',
        role: 'user',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockQueryBuilder.single.mockResolvedValueOnce({ data: mockCreatedProfile, error: null });

      const result = await userProfileService.createProfile('user123', createData);
      expect(result).toEqual(mockCreatedProfile);
    });

    it('should throw error when creation fails', async () => {
      const mockError = new Error('Failed to create profile');
      mockQueryBuilder.single.mockResolvedValueOnce({ data: null, error: mockError });

      await expect(userProfileService.createProfile('user123', {})).rejects.toThrow(mockError);
    });
  });

  describe('deleteProfile', () => {
    it('should delete user profile successfully', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({ error: null });

      await expect(userProfileService.deleteProfile('user123')).resolves.not.toThrow();
    });

    it('should throw error when deletion fails', async () => {
      const mockError = new Error('Failed to delete profile');
      mockQueryBuilder.single.mockResolvedValueOnce({ error: mockError });

      await expect(userProfileService.deleteProfile('user123')).rejects.toThrow(mockError);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      logger.setTestMode(true);
    });

    afterEach(() => {
      logger.setTestMode(false);
    });

    it('handles non-Error objects in catch blocks', async () => {
      const nonErrorObject = { message: 'Not an Error instance' };
      mockQueryBuilder.select.mockImplementationOnce(() => {
        throw nonErrorObject;
      });

      await expect(userProfileService.getProfile('123')).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to fetch profile',
        expect.any(Error)
      );
    });

    it('handles database errors in profile creation', async () => {
      const mockError = new Error('Database error');
      mockQueryBuilder.single.mockResolvedValueOnce({ error: mockError });

      await expect(userProfileService.createProfile('123', {})).rejects.toThrow(mockError);
      expect(logger.error).toHaveBeenCalledWith(
        mockError.message,
        mockError
      );
    });

    it('handles database errors in profile update', async () => {
      const mockError = new Error('Update error');
      mockQueryBuilder.single.mockResolvedValueOnce({ error: mockError });

      await expect(userProfileService.updateProfile('123', {})).rejects.toThrow(mockError);
      expect(logger.error).toHaveBeenCalledWith(
        mockError.message,
        mockError
      );
    });

    it('handles database errors in profile deletion', async () => {
      const mockError = new Error('Deletion error');
      mockQueryBuilder.single.mockResolvedValueOnce({ error: mockError });

      await expect(userProfileService.deleteProfile('123')).rejects.toThrow(mockError);
      expect(logger.error).toHaveBeenCalledWith(
        mockError.message,
        mockError
      );
    });
  });
}); 