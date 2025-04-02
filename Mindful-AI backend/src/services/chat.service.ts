// src/services/chat.service.ts

import { supabase, supabase_admin } from '../config/supabase.js';
import { chatModel } from '../config/google.js';
import { createVectorStore } from '../config/supabase.js';
import { config } from '../config/index.js';
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

interface ChatResponse {
  response: string;
  sources?: Array<{title: string, content: string}>;
}

interface TopicChatResult {
  sessionId: string;
  initialResponse: string;
}

interface ChatTopic {
  title: string;
  description?: string;
  icon?: string;
  category?: string;
  displayOrder?: number;
  createdBy?: string;
}

class ChatService {
  private vectorStore;
  private model;

  constructor() {
    this.model = chatModel;
    this.vectorStore = createVectorStore();
  }

  /**
   * Process a chat message and return a response
   */
  async processMessage(
    userId: string, 
    sessionId: string, 
    message: string, 
    category?: string
  ): Promise<ChatResponse> {
    try {
      // 1. Load conversation history
      const history = await this.loadChatHistory(sessionId);
      
      // 2. Generate search query based on conversation context
      const searchQuery = await this.generateSearchQuery(history, message);
      
      // 3. Retrieve relevant documents from vector store
      let documents;
      if (category) {
        // If category is provided, filter by it
        documents = await this.vectorStore.similaritySearch(
          searchQuery, 
          config.env.chatAi.similaritySearchResults, 
          { 'metadata.category': category }
        );
      } else {
        // Otherwise, search across all documents
        documents = await this.vectorStore.similaritySearch(
          searchQuery, 
          config.env.chatAi.similaritySearchResults
        );
      }
      
      // Extract relevant context from documents
      const context = documents.map(doc => `
Title: ${doc.metadata.title || 'Untitled'}
Content: ${doc.pageContent}
      `).join('\n\n');
      
      // 4. Generate response using the context
      const promptTemplate = PromptTemplate.fromTemplate(`
You are MindfulAI, a mental health companion. Your goal is to provide supportive, empathetic responses
based on the user's questions and the provided information sources. Always answer in a calm, supportive tone.

Chat History: 
{history}

User Question: {question}

Relevant Information:
{context}

Instructions:
- Answer based on the provided information when possible
- Be supportive and empathetic, focusing on mental wellbeing
- If you don't know or the information isn't in the context, be honest and helpful
- Do not mention that you're using specific documents or sources directly in your response
- Keep responses concise, clear, and conversational

Response:
      `);
      
      const chain = RunnableSequence.from([
        {
          history: () => history,
          question: () => message,
          context: () => context.length > 0 ? context : "No specific information available on this topic."
        },
        promptTemplate,
        this.model,
        new StringOutputParser(),
      ]);
      
      const response = await chain.invoke({});
      
      // 5. Save the interaction to history
      await this.saveChatMessage(userId, sessionId, message, response);
      
      // 6. Return the response along with sources (if available)
      const sources = documents.length > 0 
        ? documents.map(doc => ({
            title: doc.metadata.title || 'Untitled',
            content: doc.pageContent.substring(0, 150) + '...' // Truncate for display
          })) 
        : undefined;
        
      return { response, sources };
    } catch (error: any) {
      console.error('Error processing message:', error);
      throw new Error(`Failed to process message: ${error.message}`);
    }
  }

  /**
   * Generate a search query based on chat history and current message
   */
  private async generateSearchQuery(history: string, question: string): Promise<string> {
    const queryPrompt = PromptTemplate.fromTemplate(
      "Based on the conversation history and the current question, generate a search query that would help find relevant information:\n\nHistory: {history}\n\nQuestion: {question}\n\nSearch Query:"
    );
    
    const queryChain = RunnableSequence.from([
      {
        history: () => history,
        question: () => question
      },
      queryPrompt,
      this.model,
      new StringOutputParser()
    ]);
    
    return queryChain.invoke({});
  }

  /**
   * Load chat history for a specific session
   */
  async loadChatHistory(sessionId: string): Promise<string> {
    const { data, error } = await supabase_admin
      .from('chat_messages')
      .select('user_message, ai_response, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error loading chat history:', error);
      return "No previous conversation history.";
    }
    
    if (!data || data.length === 0) {
      return "No previous conversation history.";
    }
    
    // Format history as a string of interactions
    return data.map(msg => 
      `User: ${msg.user_message}\nAI: ${msg.ai_response}`
    ).join('\n\n');
  }

  /**
   * Save a chat message and response to history
   */
  async saveChatMessage(
    userId: string, 
    sessionId: string, 
    userMessage: string, 
    aiResponse: string
  ): Promise<void> {
    const { error } = await supabase
      .from('chat_messages')
      .insert({
        user_id: userId,
        session_id: sessionId,
        user_message: userMessage,
        ai_response: aiResponse,
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Error saving chat message:', error);
      throw new Error(`Failed to save chat message: ${error.message}`);
    }
    
    // Update last_message_at in the sessions table
    const { error: updateError } = await supabase
      .from('chat_sessions')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', sessionId);
    
    if (updateError) {
      console.error('Error updating session last message time:', updateError);
      // Not throwing here as the message was saved successfully
    }
  }

  /**
   * Create a new chat session
   */
  async createChatSession(userId: string, title?: string): Promise<string> {
    // Generate a default title if none provided
    const sessionTitle = title || `Chat ${new Date().toLocaleString()}`;
    
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: userId,
        title: sessionTitle,
        created_at: new Date().toISOString(),
        last_message_at: new Date().toISOString()
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('Error creating chat session:', error);
      throw new Error(`Failed to create chat session: ${error.message}`);
    }
    
    return data.id;
  }

  /**
   * Get all chat sessions for a user
   */
  async getUserChatSessions(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('id, title, created_at, last_message_at')
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false });
    
    if (error) {
      console.error('Error getting user chat sessions:', error);
      throw new Error(`Failed to get user chat sessions: ${error.message}`);
    }
    
    return data || [];
  }

  /**
   * Start chat based on a specific topic/category
   */
  async startTopicChat(
    userId: string, 
    topic: string
  ): Promise<TopicChatResult> {
    // Create a new session with the topic as title
    const sessionId = await this.createChatSession(userId, topic);
    
    // Generate an initial message based on the topic
    const topicPrompt = `Tell me about ${topic}`;
    
    // Process this initial message
    const { response } = await this.processMessage(userId, sessionId, topicPrompt, topic);
    
    return {
      sessionId,
      initialResponse: response
    };
  }

  /**
   * Get predefined chat topics
   */
  async getChatTopics(): Promise<any[]> {
    const { data, error } = await supabase
      .from('chat_topics')
      .select('*')
      .order('display_order', { ascending: true });
    
    if (error) {
      console.error('Error getting chat topics:', error);
      throw new Error(`Failed to get chat topics: ${error.message}`);
    }
    
    return data || [];
  }

  /**
   * Delete a chat session
   */
//   async deleteChatSession(userId: string, sessionId: string): Promise<boolean> {
//     try {
//       // First check if the session belongs to the user
//       const { data: sessionData, error: sessionError } = await supabase_admin
//         .from('chat_sessions')
//         .select('id')
//         .eq('id', sessionId)
//         .eq('user_id', userId)
//         .single();
      
//       if (sessionError || !sessionData) {
//         console.error('Error finding session to delete:', sessionError);
//         return false;
//       }
      
//       // Delete all messages in the session
//       const { error: messagesError } = await supabase_admin
//         .from('chat_messages')
//         .delete()
//         .eq('session_id', sessionId);
      
//       if (messagesError) {
//         console.error('Error deleting session messages:', messagesError);
//         throw new Error(`Failed to delete session messages: ${messagesError.message}`);
//       }
      
//       // Delete the session itself
//       const { error: deleteError } = await supabase
//         .from('chat_sessions')
//         .delete()
//         .eq('id', sessionId);
      
//       if (deleteError) {
//         console.error('Error deleting session:', deleteError);
//         throw new Error(`Failed to delete session: ${deleteError.message}`);
//       }
      
//       return true;
//     } catch (error: any) {
//       console.error('Error in deleteChatSession:', error);
//       throw error;
//     }
//   }


/**
 * Delete a chat session
 */
async deleteChatSession(userId: string, sessionId: string): Promise<boolean> {
    try {
      // First check if the session belongs to the user
      const { data: sessionData, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single();
      
      if (sessionError || !sessionData) {
        console.error('Error finding session to delete:', sessionError);
        return false;
      }
      
      // Delete all messages in the session first to avoid foreign key constraints
      const { error: messagesError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('session_id', sessionId);
      
      if (messagesError) {
        console.error('Error deleting session messages:', messagesError);
        throw new Error(`Failed to delete session messages: ${messagesError.message}`);
      }
      
      // Then delete the session itself
      const { error: deleteError } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId);
      
      if (deleteError) {
        console.error('Error deleting session:', deleteError);
        throw new Error(`Failed to delete session: ${deleteError.message}`);
      }
      
      return true;
    } catch (error: any) {
      console.error('Error in deleteChatSession:', error);
      throw error;
    }
  }

  /**
 * Generate a title for a chat session based on the message
 */
async generateChatTitle(userId: string, sessionId: string, message: string): Promise<string> {
    try {
      // Check if session exists and belongs to user
      const { data: sessionData, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single();
      
      if (sessionError || !sessionData) {
        console.error('Error finding session:', sessionError);
        return "New Conversation";
      }
      
      // Generate title using the LLM
      const promptTemplate = PromptTemplate.fromTemplate(`
  Generate a concise, descriptive title (4-6 words max) for a chat conversation that starts with this message:
  "{message}"
  
  The title should be descriptive of the content or intent of the message. 
  Do not use quotes in the title. Just return the title text directly.
  
  Title:
      `);
      
      const chain = RunnableSequence.from([
        promptTemplate,
        this.model,
        new StringOutputParser(),
      ]);
      
      let title = await chain.invoke({
        message: message.substring(0, 200) // Truncate long messages
      });
      
      // Clean up and trim the title
      title = title.trim();
      if (title.length > 50) {
        title = title.substring(0, 47) + '...';
      }
      
      // Update the session title
      const { error: updateError } = await supabase
        .from('chat_sessions')
        .update({ title })
        .eq('id', sessionId);
      
      if (updateError) {
        console.error('Error updating session title:', updateError);
      }
      
      return title;
    } catch (error: any) {
      console.error('Error generating chat title:', error);
      return "New Conversation";
    }
  }

  /**
 * Update the title of a chat session
 */
async updateChatTitle(userId: string, sessionId: string, title: string): Promise<boolean> {
    try {
      // Check if session exists and belongs to user
      const { data: sessionData, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single();
      
      if (sessionError || !sessionData) {
        console.error('Error finding session:', sessionError);
        return false;
      }
      
      // Update the session title
      const { error: updateError } = await supabase
        .from('chat_sessions')
        .update({ title })
        .eq('id', sessionId);
      
      if (updateError) {
        console.error('Error updating session title:', updateError);
        return false;
      }
      
      return true;
    } catch (error: any) {
      console.error('Error updating chat title:', error);
      return false;
    }
  }

  /**
   * Create a new chat topic (admin only)
   */
  async createChatTopic(topic: ChatTopic): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('chat_topics')
        .insert({
          title: topic.title,
          description: topic.description || '',
          icon: topic.icon || '',
          category: topic.category || 'general',
          display_order: topic.displayOrder || 0,
          created_at: new Date().toISOString(),
          created_by: topic.createdBy
        })
        .select('id')
        .single();
      
      if (error) {
        console.error('Error creating chat topic:', error);
        throw new Error(`Failed to create chat topic: ${error.message}`);
      }
      
      return data.id;
    } catch (error: any) {
      console.error('Error in createChatTopic:', error);
      throw error;
    }
  }

  /**
   * Update an existing chat topic (admin only)
   */
  async updateChatTopic(topicId: string, updates: Partial<ChatTopic>): Promise<boolean> {
    try {
      // Prepare updates with snake_case field names for Supabase
      const supabaseUpdates: any = {};
      
      if (updates.title !== undefined) supabaseUpdates.title = updates.title;
      if (updates.description !== undefined) supabaseUpdates.description = updates.description;
      if (updates.icon !== undefined) supabaseUpdates.icon = updates.icon;
      if (updates.category !== undefined) supabaseUpdates.category = updates.category;
      if (updates.displayOrder !== undefined) supabaseUpdates.display_order = updates.displayOrder;
      
      // Update the topic
      const { error } = await supabase
        .from('chat_topics')
        .update(supabaseUpdates)
        .eq('id', topicId);
      
      if (error) {
        console.error('Error updating chat topic:', error);
        throw new Error(`Failed to update chat topic: ${error.message}`);
      }
      
      return true;
    } catch (error: any) {
      console.error('Error in updateChatTopic:', error);
      throw error;
    }
  }

  /**
 * Get the last active chat session for a user
 */
async getLastChatSession(userId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('user_id', userId)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error) {
        console.error('Error fetching last chat session:', error);
        return null;
      }
      
      return data ? data.id : null;
    } catch (error: any) {
      console.error('Error in getLastChatSession:', error);
      return null;
    }
  }

  /**
   * Delete a chat topic (admin only)
   */
  async deleteChatTopic(topicId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('chat_topics')
        .delete()
        .eq('id', topicId);
      
      if (error) {
        console.error('Error deleting chat topic:', error);
        throw new Error(`Failed to delete chat topic: ${error.message}`);
      }
      
      return true;
    } catch (error: any) {
      console.error('Error in deleteChatTopic:', error);
      throw error;
    }
  }

  /**
   * Get chat usage analytics (admin only)
   */
  async getChatAnalytics(startDate?: string, endDate?: string): Promise<any> {
    try {
      // Default to last 30 days if no date range provided
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate 
        ? new Date(startDate) 
        : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const formattedStartDate = start.toISOString();
      const formattedEndDate = end.toISOString();
      
      // Get total number of sessions in the date range
      const { data: sessionData, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('id', { count: 'exact' })
        .gte('created_at', formattedStartDate)
        .lte('created_at', formattedEndDate);
      
      if (sessionError) {
        throw new Error(`Failed to get session count: ${sessionError.message}`);
      }
      
      // Get total number of messages in the date range
      const { data: messageData, error: messageError } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact' })
        .gte('created_at', formattedStartDate)
        .lte('created_at', formattedEndDate);
      
      if (messageError) {
        throw new Error(`Failed to get message count: ${messageError.message}`);
      }
      
      // Get active users count (users who have created sessions in the date range)
      const { data: userData, error: userError } = await supabase
        .from('chat_sessions')
        .select('user_id')
        .gte('created_at', formattedStartDate)
        .lte('created_at', formattedEndDate);
      
      if (userError) {
        throw new Error(`Failed to get user data: ${userError.message}`);
      }
      
      const uniqueUsers = new Set(userData.map(session => session.user_id)).size;
      
      // Get popular topics
      const { data: topicData, error: topicError } = await supabase
        .from('chat_sessions')
        .select('title, id')
        .gte('created_at', formattedStartDate)
        .lte('created_at', formattedEndDate);
      
      if (topicError) {
        throw new Error(`Failed to get topic data: ${topicError.message}`);
      }
      
      // Count sessions per topic
      const topicCounts: Record<string, number> = {};
      topicData.forEach(session => {
        const title = session.title || 'Untitled';
        topicCounts[title] = (topicCounts[title] || 0) + 1;
      });
      
      // Sort topics by popularity
      const popularTopics = Object.entries(topicCounts)
        .map(([title, count]) => ({ title, count: count as number }))
        .sort((a: { title: string; count: number }, b: { title: string; count: number }) => b.count - a.count)
        .slice(0, 10);
      
      // Return analytics data
      return {
        timeRange: {
          start: formattedStartDate,
          end: formattedEndDate
        },
        totalSessions: sessionData.length,
        totalMessages: messageData.length,
        activeUsers: uniqueUsers,
        messagesPerSession: sessionData.length > 0 
          ? (messageData.length / sessionData.length).toFixed(2) 
          : 0,
        popularTopics
      };
    } catch (error: any) {
      console.error('Error in getChatAnalytics:', error);
      throw error;
    }
  }
}

export default ChatService;