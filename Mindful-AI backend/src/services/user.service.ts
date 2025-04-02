// src/services/user.service.ts

import { validate as isUuid } from 'uuid';
import { supabase, supabase_admin } from '../config/supabase.js';

export class UserService {
  private supabase = supabase;
  private supabase_admin = supabase_admin;

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string) {
    try {
      if (!userId || !isUuid(userId)) {
        return {
          status: false,
          msg: "Invalid or missing user ID",
          statusCode: 400
        };
      }

      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        return {
          status: false,
          msg: "User profile not found",
          statusCode: 404
        };
      }

      return {
        status: true,
        msg: "User profile retrieved",
        data: {
          profile: data
        }
      };
    } catch (error) {
      console.error("Error occurred while getting user profile:", error);
      
      return {
        status: false,
        msg: "An error occurred while processing your request. Please try again later.",
        statusCode: 500
      };
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, profileData: any) {
    try {
      if (!userId || !isUuid(userId)) {
        return {
          status: false,
          msg: "Invalid or missing user ID",
          statusCode: 400
        };
      }

      if (!profileData || Object.keys(profileData).length === 0) {
        return {
          status: false,
          msg: "No data provided for update",
          statusCode: 400
        };
      }

      // Ensure we can only update allowed fields
      const allowedFields = ['full_name', 'avatar_url', 'website'];
      const filteredData = Object.keys(profileData)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = profileData[key];
          return obj;
        }, {} as any);

      // Add updated_at timestamp
      filteredData.updated_at = new Date().toISOString();

      const { data, error } = await this.supabase
        .from('profiles')
        .update(filteredData)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        return {
          status: false,
          msg: "Failed to update profile",
          statusCode: 400
        };
      }

      return {
        status: true,
        msg: "Profile updated successfully",
        data: {
          profile: data
        }
      };
    } catch (error) {
      console.error("Error occurred while updating profile:", error);
      
      return {
        status: false,
        msg: "An error occurred while processing your request. Please try again later.",
        statusCode: 500
      };
    }
  }

  /**
   * Admin: Delete user
   */
  async deleteUser(userId: string) {
    try {
      if (!userId || !isUuid(userId)) {
        return {
          status: false,
          msg: "Invalid or missing user ID",
          statusCode: 400
        };
      }

      const { error } = await this.supabase_admin.auth.admin.deleteUser(userId);

      if (error) {
        return {
          status: false,
          msg: error.message,
          statusCode: 400
        };
      }

      return {
        status: true,
        msg: "User deleted successfully"
      };
    } catch (error) {
      console.error("Error occurred while deleting user:", error);
      
      return {
        status: false,
        msg: "An error occurred while processing your request. Please try again later.",
        statusCode: 500
      };
    }
  }
}

export default  UserService 