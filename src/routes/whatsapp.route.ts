// src/routes/whatsapp.routes.ts

import express, { Request, Response } from 'express';
import WhatsAppController from '../controllers/whatsapp.controller.js';
import AuthMiddleware from '../middleware/auth.middleware.js';

const router = express.Router();
const whatsappController = new WhatsAppController();
const authMiddleware = new AuthMiddleware();

// Get WhatsApp authorization URL
router.get('/auth-url',
  (req: Request, res: Response) => {
    whatsappController.getAuthUrl(req, res);
  }
);

// Exchange code for token and complete integration
router.post('/complete-integration',
  authMiddleware.requireAuth,
  (req: Request, res: Response) => {
    whatsappController.completeIntegration(req, res);
  }
);



// Route for completing integration with token (new method)
router.post('/complete-token-integration',
  authMiddleware.requireAuth,
  (req: Request, res: Response) => {
    whatsappController.completeTokenIntegration(req, res);
  }
);



// Exchange code for token only
router.post('/exchange-code',
  (req: Request, res: Response) => {
    whatsappController.exchangeCode(req, res);
  }
);

// Get WhatsApp account details
router.get('/account',
  authMiddleware.requireAuth,
  (req: Request, res: Response) => {
    whatsappController.getAccount(req, res);
  }
);

// Webhook GET endpoint for verification
router.get('/webhook',
  (req: Request, res: Response) => {
    whatsappController.handleWebhookVerification(req, res);
  }
);

// Webhook POST endpoint for events
router.post('/webhook',
  (req: Request, res: Response) => {
    whatsappController.handleWebhookEvent(req, res);
  }
);

router.post('/send-message',
  authMiddleware.requireAuth,
  (req: Request, res: Response) => {
    whatsappController.sendMessage(req, res);
  }
);

// Add these routes to your existing routes

// Get phone numbers for the current user
router.get('/phone-numbers',
  authMiddleware.requireAuth,
  (req: Request, res: Response) => {
    whatsappController.getPhoneNumbers(req, res);
  }
);

// Register a new phone number
router.post('/register-phone-number',
  authMiddleware.requireAuth,
  (req: Request, res: Response) => {
    whatsappController.registerPhoneNumber(req, res);
  }
);

// Request verification code for a phone number

router.post('/request-verification-code',
  authMiddleware.requireAuth,
  (req: Request, res: Response) => {
    whatsappController.requestVerificationCode(req, res);
  }
);

// Verify phone number
router.post('/verify-phone-number',
  authMiddleware.requireAuth,
  (req: Request, res: Response) => {
    whatsappController.verifyPhoneNumber(req, res);
  }
);


router.post('/register-cloud-api',
  authMiddleware.requireAuth,
  (req: Request, res: Response) => {
    whatsappController.registerForCloudAPI(req, res);
  }
);

export default router;