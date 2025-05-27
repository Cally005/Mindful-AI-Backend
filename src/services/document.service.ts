// src/services/document.service.ts


import { createVectorStore } from '../config/supabase.js';
import { createTextSplitter } from '../config/document.js';
import { config } from '../config/index.js';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { supabase, supabase_admin } from '../config/supabase.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface DocumentMetadata {
  title: string;
  description?: string;
  category?: string;
  // uploadedBy: string;
}

interface ProcessResult {
  success: boolean;
  message: string;
  documentId?: string;
}

interface DeleteResult {
  success: boolean;
  message: string;
}

export class DocumentService {
  public vectorStore;
  private supabase = supabase;
    private supabase_admin = supabase_admin;

  constructor() {
    this.vectorStore = createVectorStore();
  }

  /**
   * Process an uploaded file, chunk it, and store it in the vector database
   */
  async processDocument(
    file: Express.Multer.File,
    metadata: DocumentMetadata
  ): Promise<ProcessResult> {
    try {
      // Save file temporarily
      const tempPath = path.join(os.tmpdir(), file.originalname);
      fs.writeFileSync(tempPath, file.buffer);

      // Load documents based on file type
      let docs: Array<{ pageContent: string; metadata: Record<string, any> }>;
      const fileExtension = path.extname(file.originalname).toLowerCase();
      
      if (fileExtension === '.pdf') {
        const loader = new PDFLoader(tempPath);
        docs = await loader.load();
      } else if (fileExtension === '.docx') {
        const loader = new DocxLoader(tempPath);
        docs = await loader.load();
      } else if (['.txt', '.md', '.html'].includes(fileExtension)) {
        const loader = new TextLoader(tempPath);
        docs = await loader.load();
      } else {
        // Clean up temp file
        fs.unlinkSync(tempPath);
        return { 
          success: false, 
          message: `Unsupported file format: ${fileExtension}` 
        };
      }

      // Add metadata to documents
      docs = docs.map(doc => ({
        ...doc,
        metadata: {
          ...doc.metadata,
          title: metadata.title,
          description: metadata.description || '',
          category: metadata.category || 'general',
          // uploadedBy: metadata.uploadedBy,
          uploadedAt: new Date().toISOString(),
          source: file.originalname
        }
      }));

      // Split documents into chunks using configured chunk size
      const textSplitter = createTextSplitter();
      const splitDocs = await textSplitter.splitDocuments(docs);
      
      // Store document metadata in a separate table for reference
      const { data: documentData, error: documentError } = await supabase_admin
        .from('document_metadata')
        .insert({
          title: metadata.title,
          description: metadata.description || '',
          category: metadata.category || 'general',
          file_name: file.originalname,
          // uploaded_by: metadata.uploadedBy,
          chunk_count: splitDocs.length,
          file_type: fileExtension.replace('.', '')
        })
        .select('id')
        .single();

      if (documentError) {
        throw new Error(`Failed to store document metadata: ${documentError.message}`);
      }

      const documentId = documentData.id;

      // Add document ID to each chunk's metadata
      const docsWithId = splitDocs.map(doc => ({
        ...doc,
        metadata: {
          ...doc.metadata,
          documentId
        }
      }));

      // Store in vector database
      await this.vectorStore.addDocuments(docsWithId);

      // Clean up temp file
      fs.unlinkSync(tempPath);

      return { 
        success: true, 
        message: `Successfully processed ${file.originalname} into ${splitDocs.length} chunks`, 
        documentId 
      };
    } catch (error: any) {
      console.error('Error processing document:', error);
      return { success: false, message: `Error processing document: ${error.message}` };
    }
  }

  /**
   * Delete a document and all its chunks from the vector database
   */
  async deleteDocument(documentId: string): Promise<DeleteResult> {
    try {
      // Delete from vector store
      const { error: vectorDeleteError } = await supabase_admin
        .from(config.env.vectorDb.tableName)
        .delete()
        .filter('metadata->>documentId', 'eq', documentId);

      if (vectorDeleteError) {
        throw new Error(`Failed to delete document chunks: ${vectorDeleteError.message}`);
      }

      // Delete metadata
      const { error: metadataDeleteError } = await supabase_admin
        .from('document_metadata')
        .delete()
        .eq('id', documentId);

      if (metadataDeleteError) {
        throw new Error(`Failed to delete document metadata: ${metadataDeleteError.message}`);
      }

      return { success: true, message: 'Document successfully deleted' };
    } catch (error: any) {
      console.error('Error deleting document:', error);
      return { success: false, message: `Error deleting document: ${error.message}` };
    }
  }

  /**
   * List all documents in the system
   */
  async listDocuments(): Promise<any[]> {
    const { data, error } = await supabase_admin
      .from('document_metadata')
      .select('*')
      .order('uploaded_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list documents: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Search for documents by category
   */
  async getDocumentsByCategory(category: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('document_metadata')
      .select('*')
      .eq('category', category)
      .order('uploaded_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get documents by category: ${error.message}`);
    }

    return data || [];
  }
  
  /**
   * Get all available document categories
   */
  async getCategories(): Promise<string[]> {
    const { data, error } = await supabase
      .from('document_metadata')
      .select('category')
      .order('category');
    
    if (error) {
      throw new Error(`Failed to fetch categories: ${error.message}`);
    }
    
    // Extract unique categories
    const categories = [...new Set(data.map(item => item.category))].filter(Boolean);
    
    return categories;
  }
  
  /**
   * Get document statistics (admin only)
   */
  async getDocumentStats(): Promise<any> {
    // Get total number of documents
    const { data: docData, error: docError } = await supabase_admin
      .from('document_metadata')
      .select('id', { count: 'exact' });
    
    if (docError) {
      throw new Error(`Failed to get document count: ${docError.message}`);
    }
    
    // Get total number of chunks
    const { data: chunkData, error: chunkError } = await supabase_admin
      .from('document_metadata')
      .select('chunk_count');
    
    if (chunkError) {
      throw new Error(`Failed to get chunk counts: ${chunkError.message}`);
    }
    
    const totalChunks = chunkData.reduce((sum, doc) => sum + (doc.chunk_count || 0), 0);
    
    // Get document types distribution
    const { data: typeData, error: typeError } = await supabase_admin
      .from('document_metadata')
      .select('file_type');
    
    if (typeError) {
      throw new Error(`Failed to get file types: ${typeError.message}`);
    }
    
    // Count documents by file type
    const fileTypeCounts: Record<string, number> = {};
    typeData.forEach(doc => {
      const fileType = doc.file_type || 'unknown';
      fileTypeCounts[fileType] = (fileTypeCounts[fileType] || 0) + 1;
    });
    
    // Get category distribution
    const { data: categoryData, error: categoryError } = await supabase_admin
      .from('document_metadata')
      .select('category');
    
    if (categoryError) {
      throw new Error(`Failed to get categories: ${categoryError.message}`);
    }
    
    // Count documents by category
    const categoryCounts: Record<string, number> = {};
    categoryData.forEach(doc => {
      const category: string = doc.category || 'uncategorized';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });
    
    return {
      totalDocuments: docData.length,
      totalChunks,
      fileTypes: fileTypeCounts,
      categories: categoryCounts
    };
  }
}

export default DocumentService;