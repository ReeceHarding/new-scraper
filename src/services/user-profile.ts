import { SupabaseClient } from '@supabase/supabase-js';
import logger from './logger';

export interface UserProfile {
  id: string;
  user_id: string;
  full_name?: string;
  company_name?: string;
  industry?: string;
  website?: string;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileData {
  full_name?: string;
  company_name?: string;
  industry?: string;
  website?: string;
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
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        logger.error(error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async updateProfile(userId: string, data: UpdateProfileData): Promise<UserProfile> {
    try {
      const { data: profile, error } = await this.client
        .from('user_profiles')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error(error);
        throw error;
      }

      return profile;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async createProfile(userId: string, data: UpdateProfileData): Promise<UserProfile> {
    try {
      const { data: profile, error } = await this.client
        .from('user_profiles')
        .insert({
          user_id: userId,
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        logger.error(error);
        throw error;
      }

      return profile;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async deleteProfile(userId: string): Promise<void> {
    try {
      const { error } = await this.client
        .from('user_profiles')
        .delete()
        .eq('user_id', userId);

      if (error) {
        logger.error(error);
        throw error;
      }
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}

// Create a default instance with the default Supabase client
import { supabase } from '@/lib/supabase';
export const userProfileService = new SupabaseUserProfileService(supabase); 