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
        logger.error(error.message, error);
        throw error;
      }

      return data;
    } catch (error) {
      const errorToLog = error instanceof Error ? error : new Error(String(error));
      logger.error(errorToLog.message, errorToLog);
      throw errorToLog;
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
        logger.error(error.message, error);
        throw error;
      }

      return profile;
    } catch (error) {
      const errorToLog = error instanceof Error ? error : new Error(String(error));
      logger.error(errorToLog.message, errorToLog);
      throw error;
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
        logger.error(error.message, error);
        throw error;
      }

      return profile;
    } catch (error) {
      const errorToLog = error instanceof Error ? error : new Error(String(error));
      logger.error(errorToLog.message, errorToLog);
      throw error;
    }
  }

  async deleteProfile(userId: string): Promise<void> {
    try {
      const { error } = await this.client
        .from('profiles')
        .delete()
        .eq('id', userId)
        .single();

      if (error) {
        logger.error(error.message, error);
        throw error;
      }
    } catch (error) {
      const errorToLog = error instanceof Error ? error : new Error(String(error));
      logger.error(errorToLog.message, errorToLog);
      throw error;
    }
  }
}

// Create a default instance with the default Supabase client
import { supabase } from '@/lib/supabase';
export const userProfileService = new SupabaseUserProfileService(supabase); 