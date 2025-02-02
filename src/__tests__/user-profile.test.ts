import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseUserProfileService, UserProfile, UpdateProfileData } from '@/services/user-profile';

interface MockQueryBuilder {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  eq: jest.Mock;
  single: jest.Mock;
}

describe('UserProfileService', () => {
  let mockClient: jest.Mocked<Partial<SupabaseClient>>;
  let mockQueryBuilder: MockQueryBuilder;
  let userProfileService: SupabaseUserProfileService;

  const mockProfile: UserProfile = {
    id: '1',
    user_id: 'user123',
    full_name: 'John Doe',
    company_name: 'Acme Inc',
    industry: 'Technology',
    website: 'https://example.com',
    created_at: '2024-02-02T00:00:00Z',
    updated_at: '2024-02-02T00:00:00Z'
  };

  beforeEach(() => {
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
    };

    mockClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    } as unknown as jest.Mocked<Partial<SupabaseClient>>;

    userProfileService = new SupabaseUserProfileService(mockClient as SupabaseClient);
  });

  describe('getProfile', () => {
    it('should return user profile when found', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({ data: mockProfile, error: null });

      const result = await userProfileService.getProfile('user123');

      expect(result).toEqual(mockProfile);
      expect(mockClient.from).toHaveBeenCalledWith('user_profiles');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('*');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user123');
    });

    it('should throw error when profile fetch fails', async () => {
      const mockError = new Error('Failed to fetch profile');
      mockQueryBuilder.single.mockResolvedValueOnce({ data: null, error: mockError });

      await expect(userProfileService.getProfile('user123')).rejects.toThrow(mockError);
    });
  });

  describe('updateProfile', () => {
    const updateData: UpdateProfileData = {
      full_name: 'Jane Doe',
      company_name: 'New Corp'
    };

    it('should update and return user profile', async () => {
      const updatedProfile = { ...mockProfile, ...updateData };
      mockQueryBuilder.single.mockResolvedValueOnce({ data: updatedProfile, error: null });

      const result = await userProfileService.updateProfile('user123', updateData);

      expect(result).toEqual(updatedProfile);
      expect(mockClient.from).toHaveBeenCalledWith('user_profiles');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(expect.objectContaining(updateData));
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user123');
    });

    it('should throw error when update fails', async () => {
      const mockError = new Error('Failed to update profile');
      mockQueryBuilder.single.mockResolvedValueOnce({ data: null, error: mockError });

      await expect(userProfileService.updateProfile('user123', updateData)).rejects.toThrow(mockError);
    });
  });

  describe('createProfile', () => {
    const createData: UpdateProfileData = {
      full_name: 'New User',
      company_name: 'New Company'
    };

    it('should create and return user profile', async () => {
      const newProfile = { ...mockProfile, ...createData };
      mockQueryBuilder.single.mockResolvedValueOnce({ data: newProfile, error: null });

      const result = await userProfileService.createProfile('user123', createData);

      expect(result).toEqual(newProfile);
      expect(mockClient.from).toHaveBeenCalledWith('user_profiles');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user123',
        ...createData
      }));
    });

    it('should throw error when creation fails', async () => {
      const mockError = new Error('Failed to create profile');
      mockQueryBuilder.single.mockResolvedValueOnce({ data: null, error: mockError });

      await expect(userProfileService.createProfile('user123', createData)).rejects.toThrow(mockError);
    });
  });

  describe('deleteProfile', () => {
    it('should delete user profile successfully', async () => {
      mockQueryBuilder.delete.mockResolvedValueOnce({ error: null });

      await userProfileService.deleteProfile('user123');

      expect(mockClient.from).toHaveBeenCalledWith('user_profiles');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user123');
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
    });

    it('should throw error when deletion fails', async () => {
      const mockError = new Error('Failed to delete profile');
      mockQueryBuilder.delete.mockResolvedValueOnce({ error: mockError });

      await expect(userProfileService.deleteProfile('user123')).rejects.toThrow(mockError);
    });
  });
}); 