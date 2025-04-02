// src/routes/document.routes.ts

import express, { Request, Response } from 'express';
import DocumentController from '../controllers/document.controller.js';
import AuthMiddleware from '../middleware/auth.middleware.js';
import AdminMiddleware from '../middleware/admin.middleware.js';

const router = express.Router();
const documentController = new DocumentController();
const authMiddleware = new AuthMiddleware();
const adminMiddleware = new AdminMiddleware();

// Document upload (admin only)
router.post('/upload', 
  authMiddleware.requireAuth, 
  adminMiddleware.requireAdmin, 
  (req: Request, res: Response) => {
    documentController.uploadDocument(req, res);
  }
);

// List all documents (admin only)
router.get('/list', 
  authMiddleware.requireAuth, 
  adminMiddleware.requireAdmin, 
  (req: Request, res: Response) => {
    documentController.listDocuments(req, res);
  }
);

// Delete a document (admin only)
router.delete('/:documentId', 
  authMiddleware.requireAuth, 
  adminMiddleware.requireAdmin, 
  (req: Request, res: Response) => {
    documentController.deleteDocument(req, res);
  }
);

// Get documents by category (admin only)
router.get('/category/:category', 
  authMiddleware.requireAuth, 
  adminMiddleware.requireAdmin, 
  (req: Request, res: Response) => {
    documentController.getDocumentsByCategory(req, res);
  }
);

// Public access to document categories (for dropdown menus, etc.)
router.get('/categories', 
  (req: Request, res: Response) => {
    documentController.getCategories(req, res);
  }
);

export default router;