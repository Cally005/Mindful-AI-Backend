// src/middleware/admin.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.js';

class AdminMiddleware {
  /**
   * Middleware to verify administrator privileges
   * Must be used after authentication middleware
   */
  requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check if user exists on request (set by auth middleware)
      if (!req.user) {
        res.status(401).json({ 
          status: false,
          msg: 'Authentication required'
        });
        return;
      }
      
      // Get user ID from authenticated request
      const userId = req.user.id;
      
      // Check for admin status in user_metadata (primary check)
      const isAdminInMetadata = req.user.user_metadata?.is_admin === true;
      
      if (isAdminInMetadata) {
        next();
        return;
      }
      
      // Secondary check: query database to verify admin role
      // Useful if admin status is not in metadata but stored in a separate table
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching user role:', error);
        res.status(500).json({
          status: false,
          msg: 'Error verifying user permissions'
        });
        return;
      }
      
      const isAdminInDb = data?.role === 'admin';
      
      if (!isAdminInDb) {
        res.status(403).json({
          status: false,
          msg: 'Admin privileges required'
        });
        return;
      }
      
      // User has admin privileges, proceed
      next();
    } catch (error: any) {
      console.error('Admin middleware error:', error);
      res.status(500).json({
        status: false,
        msg: error.message || 'Internal server error'
      });
    }
  }
  
  /**
   * Middleware to check if user has specific role permissions
   * Use after authentication middleware
   */
  requireRole = (requiredRole: string) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.user) {
          res.status(401).json({ 
            status: false,
            msg: 'Authentication required'
          });
          return;
        }
        
        // Get user ID from authenticated request
        const userId = req.user.id;
        
        // Check if user has required role
        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', userId)
          .single();
        
        if (error) {
          console.error('Error fetching user role:', error);
          res.status(500).json({
            status: false,
            msg: 'Error verifying user permissions'
          });
          return;
        }
        
        const hasRole = data?.role === requiredRole;
        
        // If user is admin, always grant access regardless of required role
        const isAdmin = data?.role === 'admin' || req.user.user_metadata?.is_admin === true;
        
        if (!hasRole && !isAdmin) {
          res.status(403).json({
            status: false,
            msg: `${requiredRole} role privileges required`
          });
          return;
        }
        
        next();
      } catch (error: any) {
        console.error('Role middleware error:', error);
        res.status(500).json({
          status: false,
          msg: error.message || 'Internal server error'
        });
      }
    };
  }
  
  /**
   * Middleware to check document ownership
   * Ensures user can only access or modify their own documents
   * Allow admins to bypass this restriction
   * Use after authentication middleware
   */
  requireOwnership = (resourceTable: string, paramName: string = 'id') => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.user) {
          res.status(401).json({ 
            status: false,
            msg: 'Authentication required'
          });
          return;
        }
        
        const resourceId = req.params[paramName];
        
        if (!resourceId) {
          res.status(400).json({
            status: false,
            msg: `Resource ID parameter '${paramName}' is required`
          });
          return;
        }
        
        // Check if user is admin
        const isAdmin = req.user.user_metadata?.is_admin === true;
        
        if (isAdmin) {
          // Admins can access any resource
          next();
          return;
        }
        
        // Check resource ownership
        const { data, error } = await supabase
          .from(resourceTable)
          .select('user_id, uploaded_by')
          .or(`user_id.eq.${req.user.id},uploaded_by.eq.${req.user.id}`)
          .eq('id', resourceId)
          .single();
        
        if (error) {
          console.error('Error checking resource ownership:', error);
          res.status(500).json({
            status: false,
            msg: 'Error verifying resource ownership'
          });
          return;
        }
        
        if (!data) {
          res.status(403).json({
            status: false,
            msg: 'You do not have permission to access this resource'
          });
          return;
        }
        
        // User is the owner, proceed
        next();
      } catch (error: any) {
        console.error('Ownership middleware error:', error);
        res.status(500).json({
          status: false,
          msg: error.message || 'Internal server error'
        });
      }
    };
  }
}

export default AdminMiddleware;