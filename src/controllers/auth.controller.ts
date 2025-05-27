import { Request, Response } from 'express';
import AuthService from '../services/auth.service.js';

interface RegisterRequest {
 email: string;
 password: string;
 fullName: string;
}

interface LoginRequest {
 email: string;
 password: string;
}

interface OtpVerificationRequest {
 email: string;
 token: string;
}

interface ResendOtpRequest {
 email: string;
}

class AuthController {
 private authService: AuthService;

 constructor() {
   this.authService = new AuthService();
 }

 async register(req: Request, res: Response) {
   try {
     const { email, password, fullName } = req.body as RegisterRequest;
     
     if (!email || !password || !fullName) {
       return res.status(400).json({
         status: false,
         msg: "Email, password, and full name are required"
       });
     }

     const result = await this.authService.signUp(email, password, fullName);
     return res.status(result.statusCode || 200).json(result);
   } catch (error: any) {
     console.error("Registration error:", error);
     return res.status(500).json({
       status: false,
       msg: error.message || "An error occurred during registration"
     });
   }
 }

 async verifyOtp(req: Request, res: Response) {
   try {
     const { email, token } = req.body as OtpVerificationRequest;
     
     if (!email || !token) {
       return res.status(400).json({
         status: false,
         msg: "Email and verification code are required"
       });
     }

     const result = await this.authService.verifyOtp(email, token);
     return res.status(result.statusCode || 200).json(result);
   } catch (error: any) {
     console.error("OTP verification error:", error);
     return res.status(500).json({
       status: false,
       msg: error.message || "An error occurred during verification"
     });
   }
 }

 async resendOtp(req: Request, res: Response) {
   try {
     const { email } = req.body as ResendOtpRequest;
     
     if (!email) {
       return res.status(400).json({
         status: false,
         msg: "Email is required"
       });
     }

     const result = await this.authService.resendOtp(email);
     return res.status(result.statusCode || 200).json(result);
   } catch (error: any) {
     console.error("Resend OTP error:", error);
     return res.status(500).json({
       status: false,
       msg: error.message || "An error occurred while resending verification code"
     });
   }
 }

 async login(req: Request, res: Response) {
   try {
     const { email, password } = req.body as LoginRequest;
     
     if (!email || !password) {
       return res.status(400).json({
         status: false,
         msg: "Email and password are required"
       });
     }

     const result = await this.authService.login(email, password);
     return res.status(result.statusCode || 200).json(result);
   } catch (error: any) {
     console.error("Login error:", error);
     return res.status(500).json({
       status: false,
       msg: error.message || "An error occurred during login"
     });
   }
 }

 async googleSignIn(req: Request, res: Response) {
   try {
     const redirectUrl = `${req.protocol}://${req.get('host')}/api/auth/callback`;
     const result = await this.authService.signInWithGoogle(redirectUrl);
     return res.status(result.statusCode || 200).json(result);
   } catch (error: any) {
     console.error("Google sign-in error:", error);
     return res.status(500).json({
       status: false,
       msg: error.message || "An error occurred during Google sign-in"
     });
   }
 }

 async handleCallback(req: Request, res: Response) {
   try {

    console.log("Callback request URL:", req.originalUrl);
    console.log("Query parameters:", req.query);
    
     const code = req.query.code as string;
     
     if (!code) {
       return res.status(400).json({
         status: false,
         msg: "Invalid or missing code"
       });
     }

     const result = await this.authService.exchangeCodeForSession(code);
     return res.status(result.statusCode || 200).json(result);
   } catch (error: any) {
     console.error("Callback error:", error);
     return res.status(500).json({
       status: false,
       msg: error.message || "An error occurred processing authentication callback"
     });
   }
 }

 async logout(req: Request, res: Response) {
   try {
     const result = await this.authService.signOut();
     return res.status(result.statusCode || 200).json(result);
   } catch (error: any) {
     console.error("Logout error:", error);
     return res.status(500).json({
       status: false,
       msg: error.message || "An error occurred during logout"
     });
   }
 }

 async getCurrentUser(req: Request, res: Response) {
   try {
     const token = req.headers.authorization?.split(' ')[1];
     const result = await this.authService.getCurrentUser(token);
     return res.status(result.statusCode || 200).json(result);
   } catch (error: any) {
     console.error("Get user error:", error);
     return res.status(500).json({
       status: false,
       msg: error.message || "An error occurred retrieving user information"
     });
   }
 }

 async getAllUsers(req: Request, res: Response) {
   try {
     const result = await this.authService.getAllUsers();
     return res.status(result.statusCode || 200).json(result);
   } catch (error: any) {
     console.error("Get all users error:", error);
     return res.status(500).json({
       status: false,
       msg: error.message || "An error occurred retrieving users"
     });
   }
 }

 // Add these methods to src/controllers/auth.controller.ts

async requestPasswordReset(req: Request, res: Response) {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        status: false,
        msg: "Email is required"
      });
    }

    const result = await this.authService.requestPasswordReset(email);
    return res.status(result.statusCode || 200).json(result);
  } catch (error: any) {
    console.error("Password reset request error:", error);
    return res.status(500).json({
      status: false,
      msg: error.message || "An error occurred during password reset request"
    });
  }
}

async resetPassword(req: Request, res: Response) {
  try {
    const { password, token } = req.body;
    
    if (!password || !token) {
      return res.status(400).json({
        status: false,
        msg: "New password and reset token are required"
      });
    }

    const result = await this.authService.resetPassword(password, token);
    return res.status(result.statusCode || 200).json(result);
  } catch (error: any) {
    console.error("Password reset error:", error);
    return res.status(500).json({
      status: false,
      msg: error.message || "An error occurred during password reset"
    });
  }
}

async registerAdmin(req: Request, res: Response) {
  try {
    const { email, password, fullName, adminSecret } = req.body;
    
    if (!email || !password || !fullName || !adminSecret) {
      return res.status(400).json({
        status: false,
        msg: "Email, password, full name, and admin secret are required"
      });
    }

    const result = await this.authService.signUpAdmin(email, password, fullName, adminSecret);
    return res.status(result.statusCode || 200).json(result);
  } catch (error: any) {
    console.error("Admin registration error:", error);
    return res.status(500).json({
      status: false,
      msg: error.message || "An error occurred during admin registration"
    });
  }
}

async requestAdminPasswordReset(req: Request, res: Response) {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        status: false,
        msg: "Email is required"
      });
    }

    const result = await this.authService.requestAdminPasswordReset(email);
    return res.status(result.statusCode || 200).json(result);
  } catch (error: any) {
    console.error("Admin password reset request error:", error);
    return res.status(500).json({
      status: false,
      msg: error.message || "An error occurred during password reset request"
    });
  }
}


async resetAdminPassword(req: Request, res: Response) {
  try {
    const { password, token, adminSecret } = req.body;
    
    if (!password || !token) {
      return res.status(400).json({
        status: false,
        msg: "New password and reset token are required"
      });
    }

    if (!adminSecret) {
      return res.status(400).json({
        status: false,
        msg: "Admin secret key is required"
      });
    }

    const result = await this.authService.resetAdminPassword(password, token, adminSecret);
    return res.status(result.statusCode || 200).json(result);
  } catch (error: any) {
    console.error("Admin password reset error:", error);
    return res.status(500).json({
      status: false,
      msg: error.message || "An error occurred during password reset"
    });
  }
}

async adminLogin(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: false,
        msg: "Email and password are required"
      });
    }

    const result = await this.authService.adminLogin(email, password);
    return res.status(result.statusCode || 200).json(result);
  } catch (error: any) {
    console.error("Admin login controller error:", error);
    return res.status(500).json({
      status: false,
      msg: error.message || "An error occurred during login"
    });
  }
}

}
export default AuthController;