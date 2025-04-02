// src/config/document.ts

import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { config } from "./index.js";
import multer from 'multer';

// Text splitter configuration for document chunking
export const createTextSplitter = () => {
  return new RecursiveCharacterTextSplitter({
    chunkSize: config.env.documents.chunkSize,
    chunkOverlap: config.env.documents.chunkOverlap,
  });
};

// Multer configuration for file uploads
export const fileUploadConfig = () => {
  const storage = multer.memoryStorage();
  
  return multer({
    storage,
    limits: { fileSize: config.env.documents.maxFileSize },
    fileFilter: (req, file, cb) => {
      const ext = file.originalname.substring(file.originalname.lastIndexOf('.')).toLowerCase();
      
      if (config.env.documents.allowedFileTypes.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported file type. Allowed types: ${config.env.documents.allowedFileTypes.join(', ')}`));
      }
    }
  }).single('file');
};