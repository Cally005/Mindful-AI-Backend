import dotenv from "dotenv";

dotenv.config();

export const config = {
  env: {
    appUrl: process.env.APP_URL || 'http://localhost:3000', // Frontend URL
    port: process.env.PORT || 5000, // Backend port
    nodeEnv: process.env.NODE_ENV || 'development',
    
    supabase: {
      url: process.env.SUPABASE_URL!,
      serviceRole: process.env.SUPABASE_SERVICE_ROLE!,
      anon: process.env.SUPABASE_ANON_KEY!,
      privateKey: process.env.SUPABASE_PRIVATE_KEY!,
    },
    
    openai: process.env.OPENAI_API_KEY!,
    
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
      gemini: process.env.GEMINI_API_KEY!,
    },
    
    // New settings for vector database
    vectorDb: {
      tableName: process.env.VECTOR_TABLE_NAME || 'documents',
      queryName: process.env.VECTOR_QUERY_NAME || 'match_documents',
      embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-004',
      embeddingDimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '768'),
    },
    
    // New settings for document processing
    documents: {
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
      chunkSize: parseInt(process.env.CHUNK_SIZE || '1000'),
      chunkOverlap: parseInt(process.env.CHUNK_OVERLAP || '200'),
      allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || '.pdf,.docx,.txt,.md,.html').split(','),
    },
    
    // Chat AI settings
    chatAi: {
      model: process.env.CHAT_MODEL || 'gemini-2.0-flash',
      temperature: parseFloat(process.env.CHAT_TEMPERATURE || '0.4'),
      maxResponseTokens: parseInt(process.env.MAX_RESPONSE_TOKENS || '1024'),
      similaritySearchResults: parseInt(process.env.SIMILARITY_SEARCH_RESULTS || '5'),
    },

    // WhatsApp settings
    meta: {
      appId: process.env.META_APP_ID || '',
      appSecret: process.env.META_APP_SECRET || '',
      whatsappAuthConfig: process.env.META_APP_CONFIG_ID || '',
      redirectUri: process.env.META_REDIRECT_URI || 'http://localhost:3000/',
      apiVersion: process.env.META_API_VERSION || 'v18.0',
      webhookUrl: process.env.META_WEBHOOK_URL || '',
      webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || ''
    }
  },
};