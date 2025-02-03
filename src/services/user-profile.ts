import { SupabaseClient } from '@supabase/supabase-js';
import logger from './server-logger';

export interface UserProfile {
  id: string;
  email: string;
  display_name?: string;
  role: string;
  full_name?: string;
  company_name?: string;
  industry?: string;
  website?: string;
  phone_number?: string;
  time_zone?: string;
  status: string;
  ui_settings: Record<string, any>;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileData {
  display_name?: string;
  full_name?: string;
  company_name?: string;
  industry?: string;
  website?: string;
  phone_number?: string;
  time_zone?: string;
  ui_settings?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface UserProfileService {
  getProfile(userId: string): Promise<UserProfile | null>;
  updateProfile(userId: string, data: UpdateProfileData): Promise<UserProfile>;
  createProfile(userId: string, data: UpdateProfileData): Promise<UserProfile>;
  deleteProfile(userId: string): Promise<void>;
}

export class SupabaseUserProfileService implements UserProfileService {
  constructor(private client: SupabaseClient) {}

  async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await this.client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to fetch profile', error, {});
        throw error instanceof Error ? error : new Error(errorMessage);
      }

      if (!data) {
        const err = new Error('Profile not found');
        logger.error(err.message, err, {});
        throw err;
      }

      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to fetch profile', error, {});
      throw error instanceof Error ? error : new Error(errorMessage);
    }
  }

  async updateProfile(userId: string, data: UpdateProfileData): Promise<UserProfile> {
    try {
      const { data: profile, error } = await this.client
        .from('profiles')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(errorMessage, error, {});
        throw error instanceof Error ? error : new Error(errorMessage);
      }

      if (!profile) {
        const err = new Error('Profile not found');
        logger.error(err.message, err, {});
        throw err;
      }

      return profile;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(errorMessage, error, {});
      throw error instanceof Error ? error : new Error(errorMessage);
    }
  }

  async createProfile(userId: string, data: UpdateProfileData): Promise<UserProfile> {
    try {
      const { data: profile, error } = await this.client
        .from('profiles')
        .insert({
          id: userId,
          role: 'user',
          status: 'active',
          ui_settings: {},
          metadata: {},
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(errorMessage, error, {});
        throw error instanceof Error ? error : new Error(errorMessage);
      }

      if (!profile) {
        const err = new Error('Failed to create profile');
        logger.error(err.message, err, {});
        throw err;
      }

      return profile;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(errorMessage, error, {});
      throw error instanceof Error ? error : new Error(errorMessage);
    }
  }

  async deleteProfile(userId: string): Promise<void> {
    try {
      const { error } = await this.client
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(errorMessage, error, {});
        throw error instanceof Error ? error : new Error(errorMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(errorMessage, error, {});
      throw error instanceof Error ? error : new Error(errorMessage);
    }
  }
}

// Create a default instance with the default Supabase client
import { supabase } from '@/lib/supabase';
export const userProfileService = new SupabaseUserProfileService(supabase); 