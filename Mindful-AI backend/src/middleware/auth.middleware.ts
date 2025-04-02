import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.js';

// Extend Express Request type to include user
declare global {
 namespace Express {
   interface Request {
     user?: any;
   }
 }
}

class AuthMiddleware {
 /**
  * Middleware to verify authentication token
  */
 requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
   try {
     // Get JWT from authorization header
     const authHeader = req.headers.authorization;
     
     if (!authHeader || !authHeader.startsWith('Bearer ')) {
       res.status(401).json({ 
         status: false,
         msg: 'Authentication required. Bearer token missing.'
       });
       return;
     }
     
     const token = authHeader.split(' ')[1];
     
     if (!token) {
       res.status(401).json({ 
         status: false,
         msg: 'Authentication required. Token is empty.'
       });
       return;
     }

     const { data, error } = await supabase.auth.getUser(token);

     if (error) {
       console.error("Auth error:", error);
       res.status(401).json({ 
         status: false,
         msg: 'Invalid or expired token'
       });
       return;
     }

     if (!data.user) {
       res.status(401).json({ 
         status: false,
         msg: 'User not found'
       });
       return;
     }

     // Add user to request object
     req.user = data.user;
     
     next();
   } catch (error: any) {
     console.error('Authentication middleware error:', error);
     res.status(500).json({ 
       status: false,
       msg: error.message || 'Internal server error'
     });
   }
 }

 /**
  * Middleware to check if user has admin role
  * Use after requireAuth middleware
  */
 requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
   try {
     if (!req.user) {
       res.status(401).json({ 
         status: false,
         msg: 'Authentication required'
       });
       return;
     }

     // Check if user has admin role in user_metadata
     const isAdmin = req.user.user_metadata?.is_admin === true;

     if (!isAdmin) {
       res.status(403).json({ 
         status: false,
         msg: 'Admin access required'
       });
       return;
     }
     
     next();
   } catch (error: any) {
     console.error('Admin middleware error:', error);
     res.status(500).json({ 
       status: false,
       msg: error.message || 'Internal server error'
     });
   }
 }
}

export default AuthMiddleware;