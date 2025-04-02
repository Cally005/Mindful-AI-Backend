import express, { Request, Response } from 'express';
import AuthController from '../controllers/auth.controller.js';
import AuthMiddleware from '../middleware/auth.middleware.js';

const router = express.Router();
const authController = new AuthController();
const authMiddleware = new AuthMiddleware();

// Registration and verification
router.post('/register', (req: Request, res: Response) => {
    authController.register(req, res);
});

router.post('/verify-otp', (req: Request, res: Response) => {
    authController.verifyOtp(req, res);
});

router.post('/resend-otp', (req: Request, res: Response) => {
    authController.resendOtp(req, res);
});

// Login and authentication
router.post('/login', (req: Request, res: Response) => {
    authController.login(req, res);
});

router.get('/google', (req: Request, res: Response) => {
    authController.googleSignIn(req, res);
});

router.get('/callback', (req: Request, res: Response) => {
    authController.handleCallback(req, res);
});

router.post('/logout', (req: Request, res: Response) => {
    authController.logout(req, res);
});

// Password Reset Routes
router.post('/forgot-password', (req: Request, res: Response) => {
    authController.requestPasswordReset(req, res);
});

router.post('/reset-password', (req: Request, res: Response) => {
    authController.resetPassword(req, res);
});

// Protected routes
router.get('/current-user', authMiddleware.requireAuth, (req: Request, res: Response) => {
    authController.getCurrentUser(req, res);
});


router.get('/users', authMiddleware.requireAuth, authMiddleware.requireAdmin, (req: Request, res: Response) => {
    authController.getAllUsers(req, res);
});
// Admin routes
router.post('/admin/register', (req: Request, res: Response) => {
    authController.registerAdmin(req, res);
  });

  // Admin Authentication Routes
router.post('/admin/forgot-password', (req: Request, res: Response) => {
    authController.requestAdminPasswordReset(req, res);
  });
  
  router.post('/admin/reset-password', (req: Request, res: Response) => {
    authController.resetAdminPassword(req, res);
  });
  router.post('/admin/login', (req: Request, res: Response) => {
    authController.adminLogin(req, res);
  });

export default router;