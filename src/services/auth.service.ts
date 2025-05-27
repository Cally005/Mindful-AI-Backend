// src/services/auth.service.ts

import { validate as isUuid } from 'uuid';
import { supabase, supabase_admin } from '../config/supabase.js';

export class AuthService {
  private supabase = supabase;
  private supabase_admin = supabase_admin;

  /**
   * Create user record in users table
   */
  private async createUserRecord(userId: string, email: string, fullName: string, role: 'admin' | 'user' = 'user') {
    try {
      const { error } = await this.supabase
        .from('users')
        .upsert({
          id: userId,
          email: email,
          role: role,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (error) {
        console.error("Error creating user record:", error);
      }
    } catch (error) {
      console.error("Error in createUserRecord:", error);
    }
  }

 async signUp(email: string, password: string, fullName: string) {
  try {
    if (!email || !password || !fullName) {
      return {
        status: false,
        msg: "Email, password, and full name are required",
        statusCode: 400
      };
    }

    console.log(`Attempting to sign up user: ${email}`);

    // Sign up with Supabase - this will send an OTP
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: undefined // Set to undefined to force OTP instead of magic link
      }
    });

    if (error) {
      console.error("Supabase signup error:", error);
      return {
        status: false,
        msg: error.message,
        statusCode: 400
      };
    }

    console.log("Signup response data:", JSON.stringify(data));

    // Check if user is already registered but not confirmed
    if (data?.user?.identities?.length === 0) {
      return {
        status: false,
        msg: "Email already in use",
        statusCode: 400
      };
    }

    return {
      status: true,
      msg: "Verification code sent to your email",
      data: {
        email
      }
    };
  } catch (error) {
    console.error("Error occurred during registration:", error);
    
    return {
      status: false,
      msg: "An error occurred while processing your request. Please try again later.",
      statusCode: 500
    };
  }
}

  /**
   * Verify OTP sent via email
   */
  async verifyOtp(email: string, token: string) {
    try {
      if (!email || !token) {
        return {
          status: false,
          msg: "Email and verification code are required",
          statusCode: 400
        };
      }

      // Verify OTP with Supabase
      const { data, error } = await this.supabase.auth.verifyOtp({
        email,
        token,
        type: 'signup'
      });

      if (error) {
        return {
          status: false,
          msg: error.message,
          statusCode: 400
        };
      }

      // Create records in both users and profiles tables
      if (data.user) {
        const fullName = data.user.user_metadata?.full_name || '';
        
        // Create user record in users table with 'user' role (regular user)
        await this.createUserRecord(data.user.id, data.user.email || email, fullName, 'user');
        
        // Create profile in profiles table
        const { error: profileError } = await this.supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            full_name: fullName,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'id'
          });

        if (profileError) {
          console.error("Error creating profile:", profileError);
        }
      }

      return {
        status: true,
        msg: "Email verified successfully",
        data: {
          session: data.session,
          user: data.user
        }
      };
    } catch (error) {
      console.error("Error occurred during OTP verification:", error);
      
      return {
        status: false,
        msg: "An error occurred while processing your request. Please try again later.",
        statusCode: 500
      };
    }
  }

  /**
   * Resend OTP
   */
  async resendOtp(email: string) {
    try {
      if (!email) {
        return {
          status: false,
          msg: "Email is required",
          statusCode: 400
        };
      }
      console.log(`Attempting to resend OTP to: ${email}`);
  
      // Use the admin client with service role key
      const { data: userData, error: userError } = await supabase_admin.auth.admin.listUsers();
  
      if (userError) {
        console.error("Error checking user:", userError);
        return {
          status: false,
          msg: "Error verifying user email",
          statusCode: 400
        };
      }
  
      // Find user by email
      const user = userData?.users.find((u: { email?: string }) => u.email === email);
      
      if (!user) {
        return {
          status: false,
          msg: "No user found with this email address",
          statusCode: 404
        };
      }
  
      // Resend OTP via Supabase
      const { data, error } = await supabase_admin.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: undefined // Force OTP instead of magic link
        }
      });
  
      if (error) {
        console.error("Supabase resend OTP error:", error);
  
        if (error.message.includes("already confirmed")) {
          return {
            status: false,
            msg: "Email is already verified. Please login instead.",
            statusCode: 400
          };
        }
  
        if (error.message.includes("rate limit")) {
          return {
            status: false,
            msg: "Too many requests. Please try again later.",
            statusCode: 429
          };
        }
  
        return {
          status: false,
          msg: error.message,
          statusCode: 400
        };
      }
  
      console.log("OTP resend successful");
      return {
        status: true,
        msg: "New verification code sent to your email"
      };
    } catch (error) {
      console.error("Error occurred while resending OTP:", error);
  
      return {
        status: false,
        msg: "An error occurred while processing your request. Please try again later.",
        statusCode: 500
      };
    }
  }

  /**
   * Login with email/password
   */
  async login(email: string, password: string) {
    try {
      if (!email || !password) {
        return {
          status: false,
          msg: "Email and password are required",
          statusCode: 400
        };
      }

      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return {
          status: false,
          msg: error.message,
          statusCode: 400
        };
      }

      // Ensure user record exists in users table (for existing users who might not have it)
      if (data.user) {
        await this.createUserRecord(data.user.id, data.user.email || email, data.user.user_metadata?.full_name || '', 'user');
      }

      return {
        status: true,
        msg: "Login successful",
        data: {
          session: data.session,
          user: data.user
        }
      };
    } catch (error) {
      console.error("Error occurred during login:", error);
      
      return {
        status: false,
        msg: "An error occurred while processing your request. Please try again later.",
        statusCode: 500
      };
    }
  }

  /**
   * Initiate Google OAuth sign-in
   */
  async signInWithGoogle(redirectUrl: string) {
    
    const frontendRedirectUrl = process.env.APP_URL + '/auth/callback';

    console.log("Using redirect URL:", frontendRedirectUrl);
    try {
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          redirectTo: frontendRedirectUrl,
        }
      });

      if (error) {
        return {
          status: false,
          msg: error.message,
          statusCode: 400
        };
      }

      return {
        status: true,
        msg: "Google authentication initiated",
        data: {
          url: data.url
        }
      };
    } catch (error) {
      console.error("Error occurred during Google sign-in:", error);
      
      return {
        status: false,
        msg: "An error occurred while processing your request. Please try again later.",
        statusCode: 500
      };
    }
  }

  /**
   * Exchange OAuth code for session
   */
  async exchangeCodeForSession(code: string) {
    try {
      if (!code) {
        return {
          status: false,
          msg: "Code is required",
          statusCode: 400
        };
      }

      const { data, error } = await this.supabase.auth.exchangeCodeForSession(code);

      if (error) {
        return {
          status: false,
          msg: error.message,
          statusCode: 400
        };
      }

      // Create records for Google sign-in if it's a new user
      if (data.user) {
        const fullName = data.user.user_metadata?.full_name || 
                         data.user.user_metadata?.name || '';
        
        // Create user record in users table with 'user' role
        await this.createUserRecord(data.user.id, data.user.email || '', fullName, 'user');
                         
        // Check if profile exists
        const { data: profileData, error: profileCheckError } = await this.supabase
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .single();

        if (profileCheckError && profileCheckError.code === 'PGRST116') {
          // Profile doesn't exist, create it
          const { error: profileCreateError } = await this.supabase
            .from('profiles')
            .upsert({
              id: data.user.id,
              full_name: fullName,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'id'
            });

          if (profileCreateError) {
            console.error("Error creating profile:", profileCreateError);
          }
        }
      }

      return {
        status: true,
        msg: "Authentication successful",
        data: {
          session: data.session,
          user: data.user
        }
      };
    } catch (error) {
      console.error("Error occurred during code exchange:", error);
      
      return {
        status: false,
        msg: "An error occurred while processing your request. Please try again later.",
        statusCode: 500
      };
    }
  }

  /**
   * Logout current user
   */
  async signOut() {
    try {
      const { error } = await this.supabase.auth.signOut();

      if (error) {
        return {
          status: false,
          msg: error.message,
          statusCode: 400
        };
      }

      return {
        status: true,
        msg: "Logout successful"
      };
    } catch (error) {
      console.error("Error occurred during logout:", error);
      
      return {
        status: false,
        msg: "An error occurred while processing your request. Please try again later.",
        statusCode: 500
      };
    }
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(token?: string) {
    try {
      let authResponse;
      
      if (token) {
        authResponse = await this.supabase.auth.getUser(token);
      } else {
        authResponse = await this.supabase.auth.getUser();
      }

      const { data, error } = authResponse;

      if (error) {
        return {
          status: false,
          msg: error.message,
          statusCode: 401
        };
      }

      if (!data.user) {
        return {
          status: false,
          msg: "Not authenticated",
          statusCode: 401
        };
      }

      // Ensure user record exists in users table
      await this.createUserRecord(data.user.id, data.user.email || '', data.user.user_metadata?.full_name || '', 'user');

      // Get user profile
      const { data: profileData, error: profileError } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error("Error fetching profile:", profileError);
      }

      return {
        status: true,
        msg: "User data retrieved",
        data: {
          user: data.user,
          profile: profileData || null
        }
      };
    } catch (error) {
      console.error("Error occurred while getting user:", error);
      
      return {
        status: false,
        msg: "An error occurred while processing your request. Please try again later.",
        statusCode: 500
      };
    }
  }

  /**
   * Admin: Get all users
   */
  async getAllUsers() {
    try {
      const { data, error } = await this.supabase_admin.auth.admin.listUsers();

      if (error) {
        return {
          status: false,
          msg: error.message,
          statusCode: 400
        };
      }

      return {
        status: true,
        msg: "Users retrieved successfully",
        data: {
          users: data.users
        }
      };
    } catch (error) {
      console.error("Error occurred while listing users:", error);
      
      return {
        status: false,
        msg: "An error occurred while processing your request. Please try again later.",
        statusCode: 500
      };
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string) {
    try {
      if (!email) {
        return {
          status: false,
          msg: "Email is required",
          statusCode: 400
        };
      }

      console.log(`Requesting password reset for: ${email}`);

      // Check if user exists
      const { data, error: userError } = await this.supabase_admin.auth.admin.listUsers();
      
      if (userError) {
        console.error("Error checking user:", userError);
        return {
          status: false,
          msg: "Error verifying user email",
          statusCode: 500
        };
      }

      const userExists = data.users.some(user => user.email === email);
      
      if (!userExists) {
        // Don't reveal if the email exists or not for security reasons
        return {
          status: true,
          msg: "If your email is registered, you'll receive a password reset link shortly"
        };
      }

      const appBaseUrl = process.env.NODE_ENV === 'development' 
      ? ' https://7079-105-119-13-207.ngrok-free.app' 
      : process.env.APP_URL;
    
         const redirectUrl = `${appBaseUrl}/reset-password`;

      console.log("Using redirect URL:", redirectUrl);
      
      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl
      });

      if (error) {
        console.error("Supabase password reset error:", error);
        return {
          status: false,
          msg: error.message,
          statusCode: 400
        };
      }

      return {
        status: true,
        msg: "If your email is registered, you'll receive a password reset link shortly"
      };
    } catch (error) {
      console.error("Error occurred during password reset request:", error);
      
      return {
        status: false,
        msg: "An error occurred while processing your request. Please try again later.",
        statusCode: 500
      };
    }
  }

  async resetPassword(newPassword: string, token: string) {
    try {
      if (!newPassword || !token) {
        return {
          status: false,
          msg: "New password and reset token are required",
          statusCode: 400
        };
      }

      // Use the recovery flow directly
      try {
        // Try admin direct update first - this is the most reliable approach
        // We need to extract the user from the token first
        const { data: tokenData, error: tokenError } = await this.supabase.auth.getUser(token);

        if (!tokenError && tokenData.user) {
          // We have the user, now update their password with admin privileges
          const { error: updateError } = await this.supabase_admin.auth.admin.updateUserById(
            tokenData.user.id,
            { password: newPassword }
          );

          if (updateError) {
            throw updateError;
          }

          return {
            status: true,
            msg: "Password has been successfully reset"
          };
        }

        // If admin update fails, try the standard updateUser approach
        const { error } = await this.supabase.auth.updateUser({ 
          password: newPassword 
        });

        if (error) {
          throw error;
        }

        return {
          status: true,
          msg: "Password has been successfully reset"
        };
      } catch (error) {
        console.error("Password reset error:", error);
        
        // Try one more approach as last resort
        try {
          const { data, error: verifyError } = await this.supabase.auth.verifyOtp({
            token_hash: token,
            type: 'recovery'
          });
          
          if (verifyError || !data.user) {
            throw verifyError || new Error("Failed to verify token");
          }
          
          // We verified the token and have the user, update password
          const { error: updateError } = await this.supabase_admin.auth.admin.updateUserById(
            data.user.id,
            { password: newPassword }
          );
          
          if (updateError) {
            throw updateError;
          }
          
          return {
            status: true,
            msg: "Password has been successfully reset"
          };
        } catch (secondError) {
          console.error("Second attempt error:", secondError);
          return {
            status: false,
            msg: "Invalid or expired reset token. Please request a new password reset link.",
            statusCode: 400
          };
        }
      }
    } catch (error) {
      console.error("Error occurred during password reset:", error);
      
      return {
        status: false,
        msg: "An error occurred while processing your request. Please try again later.",
        statusCode: 500
      };
    }
  }

  /**
   * Register a new admin user
   */
  async signUpAdmin(email: string, password: string, fullName: string, adminSecret: string) {
    try {
      if (!email || !password || !fullName) {
        return {
          status: false,
          msg: "Email, password, and full name are required",
          statusCode: 400
        };
      }

      // Verify admin secret
      if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET_KEY) {
        console.warn(`Admin registration attempt with invalid secret for email: ${email}`);
        return {
          status: false,
          msg: "Invalid admin authorization",
          statusCode: 403
        };
      }

      console.log(`Attempting to sign up admin user: ${email}`);

      // Sign up with Supabase
      const { data, error } = await this.supabase_admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm admin emails
        user_metadata: {
          full_name: fullName,
          is_admin: true
        },
        app_metadata: {
          role: 'admin'
        }
      });

      if (error) {
        console.error("Admin signup error:", error);
        return {
          status: false,
          msg: error.message,
          statusCode: 400
        };
      }

      // Create records in both users and profiles tables
      if (data.user) {
        // Create user record in users table with 'admin' role
        await this.createUserRecord(data.user.id, data.user.email || email, fullName, 'admin');
        
        // Create admin profile
        const { error: profileError } = await this.supabase_admin
          .from('profiles')
          .upsert({
            id: data.user.id,
            full_name: fullName,
            is_admin: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'id'
          });

        if (profileError) {
          console.error("Error creating admin profile:", profileError);
        }
      }

      return {
        status: true,
        msg: "Admin account created successfully",
        data: {
          user: data.user
        }
      };
    } catch (error) {
      console.error("Error occurred during admin registration:", error);
      
      return {
        status: false,
        msg: "An error occurred while processing your request. Please try again later.",
        statusCode: 500
      };
    }
  }

  /**
   * Reset admin password with token and admin secret
   */
  async resetAdminPassword(newPassword: string, token: string, adminSecret: string) {
    try {
      if (!newPassword || !token) {
        return {
          status: false,
          msg: "New password and reset token are required",
          statusCode: 400
        };
      }

      // Verify admin secret
      if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET_KEY) {
        console.warn(`Admin password reset attempt with invalid secret`);
        return {
          status: false,
          msg: "Invalid admin authorization",
          statusCode: 403
        };
      }

      // Use the recovery flow - same as regular reset but verify admin role
      try {
        // Try to get user from token
        const { data: tokenData, error: tokenError } = await this.supabase.auth.getUser(token);

        if (tokenError || !tokenData.user) {
          throw new Error("Invalid token or user not found");
        }

        // Verify that the user is an admin
        const isAdmin = tokenData.user.app_metadata?.role === 'admin' || 
                       tokenData.user.user_metadata?.is_admin === true;
        
        if (!isAdmin) {
          return {
            status: false,
            msg: "This reset link is not valid for admin accounts",
            statusCode: 403
          };
        }

        // Update password with admin
        const { error: updateError } = await this.supabase_admin.auth.admin.updateUserById(
          tokenData.user.id,
          { password: newPassword }
        );

        if (updateError) {
          throw updateError;
        }

        return {
          status: true,
          msg: "Admin password has been successfully reset"
        };
      } catch (error) {
        console.error("Admin password reset error:", error);
        
        return {
          status: false,
          msg: "Invalid or expired reset token. Please request a new password reset link.",
          statusCode: 400
        };
      }
    } catch (error) {
      console.error("Error occurred during admin password reset:", error);
      
      return {
        status: false,
        msg: "An error occurred while processing your request. Please try again later.",
        statusCode: 500
      };
    }
  }

  /**
   * Request admin password reset
   */
  async requestAdminPasswordReset(email: string) {
    try {
      if (!email) {
        return {
          status: false,
          msg: "Email is required",
          statusCode: 400
        };
      }

      console.log(`Requesting admin password reset for: ${email}`);

      // Check if user exists and is an admin
      const { data, error: userError } = await this.supabase_admin.auth.admin.listUsers();
      
      if (userError) {
        console.error("Error checking user:", userError);
        return {
          status: false,
          msg: "Error verifying admin email",
          statusCode: 500
        };
      }

      const adminUser = data.users.find(user => 
        user.email === email && 
        (user.app_metadata?.role === 'admin' || user.user_metadata?.is_admin === true)
      );
      
      if (!adminUser) {
        // Don't reveal if the email exists or not for security reasons
        return {
          status: true,
          msg: "If your email is registered as an admin, you'll receive a password reset link shortly"
        };
      }

      const appBaseUrl = process.env.NODE_ENV === 'development' 
    ? 'https://7079-105-119-13-207.ngrok-free.app' 
    : process.env.APP_URL;

       const redirectUrl = `${appBaseUrl}/admin/reset-password`;

      console.log("Using admin redirect URL:", redirectUrl);
      
      const { error  } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
   
      });

      if (error) {
        console.error("Admin password reset error:", error);
        return {
          status: false,
          msg: error.message,
          statusCode: 400
        };
      }

      return {
        status: true,
        msg: "If your email is registered as an admin, you'll receive a password reset link shortly"
      };
    } catch (error) {
      console.error("Error occurred during admin password reset request:", error);
      
      return {
        status: false,
        msg: "An error occurred while processing your request. Please try again later.",
        statusCode: 500
      };
    }
  }

  /**
   * admin login email and password 
   */
  async adminLogin(email: string, password: string) {
    try {
      if (!email || !password) {
        return {
          status: false,
          msg: "Email and password are required",
          statusCode: 400
        };
      }

      console.log(`Attempting admin login for: ${email}`);

      // First authenticate the user
      const { data: authData, error: authError } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        console.error("Admin login auth error:", authError);
        return {
          status: false,
          msg: "Invalid credentials",
          statusCode: 401
        };
      }

      // Ensure user record exists in users table
      if (authData.user) {
        // Determine if this is an admin login based on metadata or profiles table
        const isAdminByMetadata = 
          (authData.user?.user_metadata?.is_admin === true) || 
          (authData.user?.app_metadata?.role === 'admin');

        // Check profiles table for admin status
        const { data: profileData } = await this.supabase
          .from('profiles')
          .select('role, is_admin')
          .eq('id', authData.user?.id)
          .single();

        const isAdminByProfile = 
          profileData?.is_admin === true || profileData?.role === 'admin';

        const userRole = (isAdminByMetadata || isAdminByProfile) ? 'admin' : 'user';
        
        await this.createUserRecord(authData.user.id, authData.user.email || email, authData.user.user_metadata?.full_name || '', userRole);
      }

      // Check if user has admin privileges in user metadata or app metadata
      const isAdminByMetadata = 
        (authData.user?.user_metadata?.is_admin === true) || 
        (authData.user?.app_metadata?.role === 'admin');

      // Additional check in profiles table if needed
      const { data: profileData, error: profileError } = await this.supabase
        .from('profiles')
        .select('role, is_admin')
        .eq('id', authData.user?.id)
        .single();

      const isAdminByProfile = 
        !profileError && 
        (profileData?.is_admin === true || profileData?.role === 'admin');

      // Verify the user is an admin
      if (!isAdminByMetadata && !isAdminByProfile) {
        // Sign out the user since they're not an admin
        await this.supabase.auth.signOut();
        
        return {
          status: false,
          msg: "Unauthorized access. Admin privileges required.",
          statusCode: 403
        };
      }

      return {
        status: true,
        msg: "Admin login successful",
        statusCode: 200,
        user: authData.user,
        session: authData.session
      };
    } catch (error) {
      console.error("Error during admin login:", error);
      
      return {
        status: false,
        msg: "An error occurred during login. Please try again later.",
        statusCode: 500
      };
    }
  }
}

export default AuthService








//doesn't update the user profile in the profiles table
// // src/services/auth.service.ts

// import { validate as isUuid } from 'uuid';
// import { supabase, supabase_admin } from '../config/supabase.js';

// export class AuthService {
//   private supabase = supabase;
//   private supabase_admin = supabase_admin;

//  async signUp(email: string, password: string, fullName: string) {
//   try {
//     if (!email || !password || !fullName) {
//       return {
//         status: false,
//         msg: "Email, password, and full name are required",
//         statusCode: 400
//       };
//     }

//     console.log(`Attempting to sign up user: ${email}`);

//     // Sign up with Supabase - this will send an OTP
//     const { data, error } = await this.supabase.auth.signUp({
//       email,
//       password,
//       options: {
//         data: {
//           full_name: fullName,
//         },
//         emailRedirectTo: undefined // Set to undefined to force OTP instead of magic link
//       }
//     });

//     if (error) {
//       console.error("Supabase signup error:", error);
//       return {
//         status: false,
//         msg: error.message,
//         statusCode: 400
//       };
//     }

//     console.log("Signup response data:", JSON.stringify(data));

//     // Check if user is already registered but not confirmed
//     if (data?.user?.identities?.length === 0) {
//       return {
//         status: false,
//         msg: "Email already in use",
//         statusCode: 400
//       };
//     }

    

//     return {
//       status: true,
//       msg: "Verification code sent to your email",
//       data: {
//         email
//       }
//     };
//   } catch (error) {
//     console.error("Error occurred during registration:", error);
    
//     return {
//       status: false,
//       msg: "An error occurred while processing your request. Please try again later.",
//       statusCode: 500
//     };
//   }
// }

//   /**
//    * Verify OTP sent via email
//    */
//   async verifyOtp(email: string, token: string) {
//     try {
//       if (!email || !token) {
//         return {
//           status: false,
//           msg: "Email and verification code are required",
//           statusCode: 400
//         };
//       }

//       // Verify OTP with Supabase
//       const { data, error } = await this.supabase.auth.verifyOtp({
//         email,
//         token,
//         type: 'signup'
//       });

//       if (error) {
//         return {
//           status: false,
//           msg: error.message,
//           statusCode: 400
//         };
//       }

//       // Create profile in profiles table
//       if (data.user) {
//         const fullName = data.user.user_metadata?.full_name || '';
        
//         const { error: profileError } = await this.supabase
//           .from('profiles')
//           .upsert({
//             id: data.user.id,
//             full_name: fullName,
//             created_at: new Date().toISOString(),
//             updated_at: new Date().toISOString(),
//           }, {
//             onConflict: 'id'
//           });

//         if (profileError) {
//           console.error("Error creating profile:", profileError);
//         }
//       }

//       return {
//         status: true,
//         msg: "Email verified successfully",
//         data: {
//           session: data.session,
//           user: data.user
//         }
//       };
//     } catch (error) {
//       console.error("Error occurred during OTP verification:", error);
      
//       return {
//         status: false,
//         msg: "An error occurred while processing your request. Please try again later.",
//         statusCode: 500
//       };
//     }
//   }


// /**
//  * Resend OTP
//  */
// async resendOtp(email: string) {
//     try {
//       if (!email) {
//         return {
//           status: false,
//           msg: "Email is required",
//           statusCode: 400
//         };
//       }
//       console.log(`Attempting to resend OTP to: ${email}`);
  
//       // Use the admin client with service role key
//       const { data: userData, error: userError } = await supabase_admin.auth.admin.listUsers();
  
//       if (userError) {
//         console.error("Error checking user:", userError);
//         return {
//           status: false,
//           msg: "Error verifying user email",
//           statusCode: 400
//         };
//       }
  
//       // Find user by email
//       const user = userData?.users.find((u: { email?: string }) => u.email === email);
      
//       if (!user) {
//         return {
//           status: false,
//           msg: "No user found with this email address",
//           statusCode: 404
//         };
//       }
  
//       // Resend OTP via Supabase
//       const { data, error } = await supabase_admin.auth.resend({
//         type: "signup",
//         email,
//         options: {
//           emailRedirectTo: undefined // Force OTP instead of magic link
//         }
//       });
  
//       if (error) {
//         console.error("Supabase resend OTP error:", error);
  
//         if (error.message.includes("already confirmed")) {
//           return {
//             status: false,
//             msg: "Email is already verified. Please login instead.",
//             statusCode: 400
//           };
//         }
  
//         if (error.message.includes("rate limit")) {
//           return {
//             status: false,
//             msg: "Too many requests. Please try again later.",
//             statusCode: 429
//           };
//         }
  
//         return {
//           status: false,
//           msg: error.message,
//           statusCode: 400
//         };
//       }
  
//       console.log("OTP resend successful");
//       return {
//         status: true,
//         msg: "New verification code sent to your email"
//       };
//     } catch (error) {
//       console.error("Error occurred while resending OTP:", error);
  
//       return {
//         status: false,
//         msg: "An error occurred while processing your request. Please try again later.",
//         statusCode: 500
//       };
//     }
//   }
//   /**
//    * Login with email/password
//    */
//   async login(email: string, password: string) {
//     try {
//       if (!email || !password) {
//         return {
//           status: false,
//           msg: "Email and password are required",
//           statusCode: 400
//         };
//       }

//       const { data, error } = await this.supabase.auth.signInWithPassword({
//         email,
//         password,
//       });

//       if (error) {
//         return {
//           status: false,
//           msg: error.message,
//           statusCode: 400
//         };
//       }

//       return {
//         status: true,
//         msg: "Login successful",
//         data: {
//           session: data.session,
//           user: data.user
//         }
//       };
//     } catch (error) {
//       console.error("Error occurred during login:", error);
      
//       return {
//         status: false,
//         msg: "An error occurred while processing your request. Please try again later.",
//         statusCode: 500
//       };
//     }
//   }

//   /**
//    * Initiate Google OAuth sign-in
//    */
//   async signInWithGoogle(redirectUrl: string) {

    
//     const frontendRedirectUrl = process.env.APP_URL + '/auth/callback';

//     console.log("Using redirect URL:", frontendRedirectUrl);
//     try {
//       const { data, error } = await this.supabase.auth.signInWithOAuth({
//         provider: 'google',
//         options: {
//           queryParams: {
//             access_type: 'offline',
//             prompt: 'consent',
//           },
//           redirectTo: frontendRedirectUrl,
//         }
//       });

//       if (error) {
//         return {
//           status: false,
//           msg: error.message,
//           statusCode: 400
//         };
//       }

//       return {
//         status: true,
//         msg: "Google authentication initiated",
//         data: {
//           url: data.url
//         }
//       };
//     } catch (error) {
//       console.error("Error occurred during Google sign-in:", error);
      
//       return {
//         status: false,
//         msg: "An error occurred while processing your request. Please try again later.",
//         statusCode: 500
//       };
//     }
//   }

//   /**
//    * Exchange OAuth code for session
//    */
//   async exchangeCodeForSession(code: string) {
//     try {
//       if (!code) {
//         return {
//           status: false,
//           msg: "Code is required",
//           statusCode: 400
//         };
//       }

//       const { data, error } = await this.supabase.auth.exchangeCodeForSession(code);

//       if (error) {
//         return {
//           status: false,
//           msg: error.message,
//           statusCode: 400
//         };
//       }

//       // Create profile for Google sign-in if it's a new user
//       if (data.user) {
//         const { data: profileData, error: profileCheckError } = await this.supabase
//           .from('profiles')
//           .select('id')
//           .eq('id', data.user.id)
//           .single();

//         if (profileCheckError && profileCheckError.code === 'PGRST116') {
//           // Profile doesn't exist, create it
//           const fullName = data.user.user_metadata?.full_name || 
//                          data.user.user_metadata?.name || '';
                         
//           const { error: profileCreateError } = await this.supabase
//             .from('profiles')
//             .upsert({
//               id: data.user.id,
//               full_name: fullName,
//               created_at: new Date().toISOString(),
//               updated_at: new Date().toISOString(),
//             }, {
//               onConflict: 'id'
//             });

//           if (profileCreateError) {
//             console.error("Error creating profile:", profileCreateError);
//           }
//         }
//       }

//       return {
//         status: true,
//         msg: "Authentication successful",
//         data: {
//           session: data.session,
//           user: data.user
//         }
//       };
//     } catch (error) {
//       console.error("Error occurred during code exchange:", error);
      
//       return {
//         status: false,
//         msg: "An error occurred while processing your request. Please try again later.",
//         statusCode: 500
//       };
//     }
//   }

//   /**
//    * Logout current user
//    */
//   async signOut() {
//     try {
//       const { error } = await this.supabase.auth.signOut();

//       if (error) {
//         return {
//           status: false,
//           msg: error.message,
//           statusCode: 400
//         };
//       }

//       return {
//         status: true,
//         msg: "Logout successful"
//       };
//     } catch (error) {
//       console.error("Error occurred during logout:", error);
      
//       return {
//         status: false,
//         msg: "An error occurred while processing your request. Please try again later.",
//         statusCode: 500
//       };
//     }
//   }

//   /**
//    * Get current authenticated user
//    */
//   async getCurrentUser(token?: string) {
//     try {
//       let authResponse;
      
//       if (token) {
//         authResponse = await this.supabase.auth.getUser(token);
//       } else {
//         authResponse = await this.supabase.auth.getUser();
//       }

//       const { data, error } = authResponse;

//       if (error) {
//         return {
//           status: false,
//           msg: error.message,
//           statusCode: 401
//         };
//       }

//       if (!data.user) {
//         return {
//           status: false,
//           msg: "Not authenticated",
//           statusCode: 401
//         };
//       }

//       // Get user profile
//       const { data: profileData, error: profileError } = await this.supabase
//         .from('profiles')
//         .select('*')
//         .eq('id', data.user.id)
//         .single();

//       if (profileError && profileError.code !== 'PGRST116') {
//         console.error("Error fetching profile:", profileError);
//       }

//       return {
//         status: true,
//         msg: "User data retrieved",
//         data: {
//           user: data.user,
//           profile: profileData || null
//         }
//       };
//     } catch (error) {
//       console.error("Error occurred while getting user:", error);
      
//       return {
//         status: false,
//         msg: "An error occurred while processing your request. Please try again later.",
//         statusCode: 500
//       };
//     }
//   }

//   /**
//    * Admin: Get all users
//    */
//   async getAllUsers() {
//     try {
//       const { data, error } = await this.supabase_admin.auth.admin.listUsers();

//       if (error) {
//         return {
//           status: false,
//           msg: error.message,
//           statusCode: 400
//         };
//       }

//       return {
//         status: true,
//         msg: "Users retrieved successfully",
//         data: {
//           users: data.users
//         }
//       };
//     } catch (error) {
//       console.error("Error occurred while listing users:", error);
      
//       return {
//         status: false,
//         msg: "An error occurred while processing your request. Please try again later.",
//         statusCode: 500
//       };
//     }
//   }

// /**
//  * Request password reset
//  */
// async requestPasswordReset(email: string) {
//   try {
//     if (!email) {
//       return {
//         status: false,
//         msg: "Email is required",
//         statusCode: 400
//       };
//     }

//     console.log(`Requesting password reset for: ${email}`);

//     // Check if user exists
//     const { data, error: userError } = await this.supabase_admin.auth.admin.listUsers();
    
//     if (userError) {
//       console.error("Error checking user:", userError);
//       return {
//         status: false,
//         msg: "Error verifying user email",
//         statusCode: 500
//       };
//     }

//     const userExists = data.users.some(user => user.email === email);
    
//     if (!userExists) {
//       // Don't reveal if the email exists or not for security reasons
//       return {
//         status: true,
//         msg: "If your email is registered, you'll receive a password reset link shortly"
//       };
//     }


//     const appBaseUrl = process.env.NODE_ENV === 'development' 
//     ? ' https://7079-105-119-13-207.ngrok-free.app' 
//     : process.env.APP_URL;
  
//        const redirectUrl = `${appBaseUrl}/reset-password`;

//     // Request password reset email - using proper URL encoding and simple URL
//     // const redirectUrl = `${process.env.APP_URL}/reset-password`;
    
//     console.log("Using redirect URL:", redirectUrl);
    
//     const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
//       redirectTo: redirectUrl
//     });

//     if (error) {
//       console.error("Supabase password reset error:", error);
//       return {
//         status: false,
//         msg: error.message,
//         statusCode: 400
//       };
//     }

//     return {
//       status: true,
//       msg: "If your email is registered, you'll receive a password reset link shortly"
//     };
//   } catch (error) {
//     console.error("Error occurred during password reset request:", error);
    
//     return {
//       status: false,
//       msg: "An error occurred while processing your request. Please try again later.",
//       statusCode: 500
//     };
//   }
// }
// async resetPassword(newPassword: string, token: string) {
//   try {
//     if (!newPassword || !token) {
//       return {
//         status: false,
//         msg: "New password and reset token are required",
//         statusCode: 400
//       };
//     }

//     // Use the recovery flow directly
//     try {
//       // Try admin direct update first - this is the most reliable approach
//       // We need to extract the user from the token first
//       const { data: tokenData, error: tokenError } = await this.supabase.auth.getUser(token);

//       if (!tokenError && tokenData.user) {
//         // We have the user, now update their password with admin privileges
//         const { error: updateError } = await this.supabase_admin.auth.admin.updateUserById(
//           tokenData.user.id,
//           { password: newPassword }
//         );

//         if (updateError) {
//           throw updateError;
//         }

//         return {
//           status: true,
//           msg: "Password has been successfully reset"
//         };
//       }

//       // If admin update fails, try the standard updateUser approach
//       // Note: We don't pass headers here - fixed TypeScript error
//       const { error } = await this.supabase.auth.updateUser({ 
//         password: newPassword 
//       });

//       if (error) {
//         throw error;
//       }

//       return {
//         status: true,
//         msg: "Password has been successfully reset"
//       };
//     } catch (error) {
//       console.error("Password reset error:", error);
      
//       // Try one more approach as last resort
//       try {
//         const { data, error: verifyError } = await this.supabase.auth.verifyOtp({
//           token_hash: token,
//           type: 'recovery'
//         });
        
//         if (verifyError || !data.user) {
//           throw verifyError || new Error("Failed to verify token");
//         }
        
//         // We verified the token and have the user, update password
//         const { error: updateError } = await this.supabase_admin.auth.admin.updateUserById(
//           data.user.id,
//           { password: newPassword }
//         );
        
//         if (updateError) {
//           throw updateError;
//         }
        
//         return {
//           status: true,
//           msg: "Password has been successfully reset"
//         };
//       } catch (secondError) {
//         console.error("Second attempt error:", secondError);
//         return {
//           status: false,
//           msg: "Invalid or expired reset token. Please request a new password reset link.",
//           statusCode: 400
//         };
//       }
//     }
//   } catch (error) {
//     console.error("Error occurred during password reset:", error);
    
//     return {
//       status: false,
//       msg: "An error occurred while processing your request. Please try again later.",
//       statusCode: 500
//     };
//   }
// }



// /**
//  * Register a new admin user
//  */
// async signUpAdmin(email: string, password: string, fullName: string, adminSecret: string) {
//   try {
//     if (!email || !password || !fullName) {
//       return {
//         status: false,
//         msg: "Email, password, and full name are required",
//         statusCode: 400
//       };
//     }

//     // Verify admin secret
//     if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET_KEY) {
//       console.warn(`Admin registration attempt with invalid secret for email: ${email}`);
//       return {
//         status: false,
//         msg: "Invalid admin authorization",
//         statusCode: 403
//       };
//     }

//     console.log(`Attempting to sign up admin user: ${email}`);

//     // Sign up with Supabase
//     const { data, error } = await this.supabase_admin.auth.admin.createUser({
//       email,
//       password,
//       email_confirm: true, // Auto-confirm admin emails
//       user_metadata: {
//         full_name: fullName,
//         is_admin: true
//       },
//       app_metadata: {
//         role: 'admin'
//       }
//     });

//     if (error) {
//       console.error("Admin signup error:", error);
//       return {
//         status: false,
//         msg: error.message,
//         statusCode: 400
//       };
//     }

//     // Create admin profile
//     if (data.user) {
//       const { error: profileError } = await this.supabase_admin
//         .from('profiles')
//         .upsert({
//           id: data.user.id,
//           full_name: fullName,
//           is_admin: true,
//           created_at: new Date().toISOString(),
//           updated_at: new Date().toISOString(),
//         }, {
//           onConflict: 'id'
//         });

//       if (profileError) {
//         console.error("Error creating admin profile:", profileError);
//       }
//     }

//     return {
//       status: true,
//       msg: "Admin account created successfully",
//       data: {
//         user: data.user
//       }
//     };
//   } catch (error) {
//     console.error("Error occurred during admin registration:", error);
    
//     return {
//       status: false,
//       msg: "An error occurred while processing your request. Please try again later.",
//       statusCode: 500
//     };
//   }
// }


// /**
//  * Reset admin password with token and admin secret
//  */



// async resetAdminPassword(newPassword: string, token: string, adminSecret: string) {
//   try {
//     if (!newPassword || !token) {
//       return {
//         status: false,
//         msg: "New password and reset token are required",
//         statusCode: 400
//       };
//     }

//     // Verify admin secret
//     if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET_KEY) {
//       console.warn(`Admin password reset attempt with invalid secret`);
//       return {
//         status: false,
//         msg: "Invalid admin authorization",
//         statusCode: 403
//       };
//     }

//     // Use the recovery flow - same as regular reset but verify admin role
//     try {
//       // Try to get user from token
//       const { data: tokenData, error: tokenError } = await this.supabase.auth.getUser(token);

//       if (tokenError || !tokenData.user) {
//         throw new Error("Invalid token or user not found");
//       }

//       // Verify that the user is an admin
//       const isAdmin = tokenData.user.app_metadata?.role === 'admin' || 
//                      tokenData.user.user_metadata?.is_admin === true;
      
//       if (!isAdmin) {
//         return {
//           status: false,
//           msg: "This reset link is not valid for admin accounts",
//           statusCode: 403
//         };
//       }

//       // Update password with admin
//       const { error: updateError } = await this.supabase_admin.auth.admin.updateUserById(
//         tokenData.user.id,
//         { password: newPassword }
//       );

//       if (updateError) {
//         throw updateError;
//       }

//       return {
//         status: true,
//         msg: "Admin password has been successfully reset"
//       };
//     } catch (error) {
//       console.error("Admin password reset error:", error);
      
//       return {
//         status: false,
//         msg: "Invalid or expired reset token. Please request a new password reset link.",
//         statusCode: 400
//       };
//     }
//   } catch (error) {
//     console.error("Error occurred during admin password reset:", error);
    
//     return {
//       status: false,
//       msg: "An error occurred while processing your request. Please try again later.",
//       statusCode: 500
//     };
//   }
// }
// /**
//  * Request admin password reset
//  */
// async requestAdminPasswordReset(email: string) {
//   try {
//     if (!email) {
//       return {
//         status: false,
//         msg: "Email is required",
//         statusCode: 400
//       };
//     }

//     console.log(`Requesting admin password reset for: ${email}`);

//     // Check if user exists and is an admin
//     const { data, error: userError } = await this.supabase_admin.auth.admin.listUsers();
    
//     if (userError) {
//       console.error("Error checking user:", userError);
//       return {
//         status: false,
//         msg: "Error verifying admin email",
//         statusCode: 500
//       };
//     }

//     const adminUser = data.users.find(user => 
//       user.email === email && 
//       (user.app_metadata?.role === 'admin' || user.user_metadata?.is_admin === true)
//     );
    
//     if (!adminUser) {
//       // Don't reveal if the email exists or not for security reasons
//       return {
//         status: true,
//         msg: "If your email is registered as an admin, you'll receive a password reset link shortly"
//       };
//     }

//     const appBaseUrl = process.env.NODE_ENV === 'development' 
//   ? 'https://7079-105-119-13-207.ngrok-free.app' 
//   : process.env.APP_URL;

//      const redirectUrl = `${appBaseUrl}/admin/reset-password`;

//     // Request password reset email with redirect to admin reset page
//     // const redirectUrl = `${process.env.APP_URL}/admin/reset-password`;
    
//     console.log("Using admin redirect URL:", redirectUrl);
    
//     const { error  } = await this.supabase.auth.resetPasswordForEmail(email, {
//       redirectTo: redirectUrl,
 
//     });

//     if (error) {
//       console.error("Admin password reset error:", error);
//       return {
//         status: false,
//         msg: error.message,
//         statusCode: 400
//       };
//     }

//     return {
//       status: true,
//       msg: "If your email is registered as an admin, you'll receive a password reset link shortly"
//     };
//   } catch (error) {
//     console.error("Error occurred during admin password reset request:", error);
    
//     return {
//       status: false,
//       msg: "An error occurred while processing your request. Please try again later.",
//       statusCode: 500
//     };
//   }
// }

// /**
//  * admin lgin email and password 
//  */

// async adminLogin(email: string, password: string) {
//   try {
//     if (!email || !password) {
//       return {
//         status: false,
//         msg: "Email and password are required",
//         statusCode: 400
//       };
//     }

//     console.log(`Attempting admin login for: ${email}`);

//     // First authenticate the user
//     const { data: authData, error: authError } = await this.supabase.auth.signInWithPassword({
//       email,
//       password
//     });

//     if (authError) {
//       console.error("Admin login auth error:", authError);
//       return {
//         status: false,
//         msg: "Invalid credentials",
//         statusCode: 401
//       };
//     }

//     // Check if user has admin privileges in user metadata or app metadata
//     const isAdminByMetadata = 
//       (authData.user?.user_metadata?.is_admin === true) || 
//       (authData.user?.app_metadata?.role === 'admin');

//     // Additional check in profiles table if needed
//     const { data: profileData, error: profileError } = await this.supabase
//       .from('profiles')
//       .select('role, is_admin')
//       .eq('id', authData.user?.id)
//       .single();

//     const isAdminByProfile = 
//       !profileError && 
//       (profileData?.is_admin === true || profileData?.role === 'admin');

//     // Verify the user is an admin
//     if (!isAdminByMetadata && !isAdminByProfile) {
//       // Sign out the user since they're not an admin
//       await this.supabase.auth.signOut();
      
//       return {
//         status: false,
//         msg: "Unauthorized access. Admin privileges required.",
//         statusCode: 403
//       };
//     }

//     return {
//       status: true,
//       msg: "Admin login successful",
//       statusCode: 200,
//       user: authData.user,
//       session: authData.session
//     };
//   } catch (error) {
//     console.error("Error during admin login:", error);
    
//     return {
//       status: false,
//       msg: "An error occurred during login. Please try again later.",
//       statusCode: 500
//     };
//   }
// }
// }

// export default  AuthService



