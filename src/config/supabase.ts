// src/config/supabase.js

import { createClient } from "@supabase/supabase-js";
import { config } from "./index.js";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

const supabaseUrl = config.env.supabase.url as string;
const supabaseKey = config.env.supabase.anon as string;
const supabaseAdminKey = config.env.supabase.serviceRole as string;
const supabasePrivateKey = config.env.supabase.privateKey as string;

// Regular Supabase clients
const supabase = createClient(supabaseUrl, supabaseKey, {
    db: {
        schema: "public"
    }
});

const supabase_admin = createClient(supabaseUrl, supabaseAdminKey, {
    db: {
        schema: "public"
    }
});

// Vector store client for document embeddings
// This function creates a Supabase vector store with Google embeddings
export const createVectorStore = () => {
    const embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: config.env.google.gemini,
        model: config.env.vectorDb.embeddingModel,
    });

    // Use the admin client for vector operations to ensure proper permissions
    return new SupabaseVectorStore(embeddings, {
        client: supabase_admin,
        tableName: config.env.vectorDb.tableName,
        queryName: config.env.vectorDb.queryName,
    });
};

export { supabase, supabase_admin };