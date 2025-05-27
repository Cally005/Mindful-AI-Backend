// src/config/google.ts

import { google } from "googleapis";
import { config } from "./index.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import dotenv from "dotenv";

dotenv.config();

const googleRedirectUri = config.env.google.redirectUri as string;
const googleClientSecret = config.env.google.clientSecret as string;
const googleClientId = config.env.google.clientId as string;

// OAuth client for authentication
export const oauth2Client = new google.auth.OAuth2(
  googleClientId,
  googleClientSecret,
  googleRedirectUri
);

// Basic Generative AI client
export const genAI = new GoogleGenerativeAI(config.env.google.gemini);

// LangChain chat model for more advanced interactions
export const chatModel = new ChatGoogleGenerativeAI({
  apiKey: config.env.google.gemini,
  model: config.env.chatAi.model,
  temperature: config.env.chatAi.temperature,
  maxOutputTokens: config.env.chatAi.maxResponseTokens,
  safetySettings: [
    // { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    // { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    // { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    // { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  ],
});