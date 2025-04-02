import OpenAI from "openai";
import { config } from "./index.js";

// Initialize OpenAI SDK
export const openai = new OpenAI({
  apiKey: config.env.openai, // Recommended: use environment variable
});
