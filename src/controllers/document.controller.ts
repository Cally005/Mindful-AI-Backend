// src/controllers/document.controller.ts

import { Request, Response } from 'express';
import DocumentService from '../services/document.service.js';
import { fileUploadConfig } from '../config/document.js';

interface DocumentMetadata {
  title: string;
  description?: string;
  category?: string;
}

class DocumentController {
  private documentService: DocumentService;
  private upload;

  constructor() {
    this.documentService = new DocumentService();
    this.upload = fileUploadConfig();
  }

  /**
   * Handle document upload
   */
  async uploadDocument(req: Request, res: Response) {
    try {
      // Use multer to process the upload
      this.upload(req, res, async (err) => {
        if (err) {
          return res.status(400).json({ 
            status: false, 
            msg: err.message 
          });
        }
        
        if (!req.file) {
          return res.status(400).json({ 
            status: false, 
            msg: 'No file uploaded' 
          });
        }
        
        // Get metadata from request body
        const { title, description, category } = req.body as DocumentMetadata;
        
        if (!title) {
          return res.status(400).json({
            status: false,
            msg: 'Title is required'
          });
        }
        
        // Get user ID from authenticated request
        const uploadedBy = req.user?.id || 'anonymous';
        
        // Process the document
        const result = await this.documentService.processDocument(req.file, {
          title,
          description,
          category,
        //   uploadedBy
        });
        
        if (result.success) {
          return res.status(200).json({
            status: true,
            msg: result.message,
            data: { documentId: result.documentId }
          });
        } else {
          return res.status(400).json({
            status: false,
            msg: result.message
          });
        }
      });
    } catch (error: any) {
      console.error('Error in document upload:', error);
      return res.status(500).json({
        status: false,
        msg: error.message || "An error occurred during document upload"
      });
    }
  }

  /**
   * List all documents
   */
  async listDocuments(req: Request, res: Response) {
    try {
      const documents = await this.documentService.listDocuments();
      return res.status(200).json({
        status: true,
        data: { documents }
      });
    } catch (error: any) {
      console.error('Error listing documents:', error);
      return res.status(500).json({
        status: false,
        msg: error.message || "An error occurred retrieving documents"
      });
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(req: Request, res: Response) {
    try {
      const { documentId } = req.params;
      
      if (!documentId) {
        return res.status(400).json({
          status: false,
          msg: 'Document ID is required'
        });
      }
      
      const result = await this.documentService.deleteDocument(documentId);
      
      if (result.success) {
        return res.status(200).json({
          status: true,
          msg: result.message
        });
      } else {
        return res.status(400).json({
          status: false,
          msg: result.message
        });
      }
    } catch (error: any) {
      console.error('Error deleting document:', error);
      return res.status(500).json({
        status: false,
        msg: error.message || "An error occurred deleting the document"
      });
    }
  }

  /**
   * Get documents by category
   */
  async getDocumentsByCategory(req: Request, res: Response) {
    try {
      const { category } = req.params;
      
      if (!category) {
        return res.status(400).json({
          status: false,
          msg: 'Category is required'
        });
      }
      
      const documents = await this.documentService.getDocumentsByCategory(category);
      
      return res.status(200).json({
        status: true,
        data: { documents }
      });
    } catch (error: any) {
      console.error('Error getting documents by category:', error);
      return res.status(500).json({
        status: false,
        msg: error.message || "An error occurred retrieving documents"
      });
    }
  }

  /**
   * Get all available document categories
   */
  async getCategories(req: Request, res: Response) {
    try {
      const categories = await this.documentService.getCategories();
      
      return res.status(200).json({
        status: true,
        data: { categories }
      });
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      return res.status(500).json({
        status: false,
        msg: error.message || "An error occurred retrieving categories"
      });
    }
  }
  
  /**
   * Get document statistics (admin only)
   */
  async getDocumentStats(req: Request, res: Response) {
    try {
      const stats = await this.documentService.getDocumentStats();
      
      return res.status(200).json({
        status: true,
        data: stats
      });
    } catch (error: any) {
      console.error('Error getting document stats:', error);
      return res.status(500).json({
        status: false,
        msg: error.message || "An error occurred retrieving document statistics"
      });
    }
  }
}

export default DocumentController;