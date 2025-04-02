// src/controllers/chat.controller.ts

import { Request, Response } from 'express';
import ChatService from '../services/chat.service.js';

interface SendMessageRequest {
  message: string;
  sessionId: string;
  category?: string;
}

interface CreateSessionRequest {
  title?: string;
}

interface StartTopicRequest {
  topic: string;
}

class ChatController {
  private chatService: ChatService;

  constructor() {
    this.chatService = new ChatService();
  }

  /**
   * Send a message to the chatbot
   */
  async sendMessage(req: Request, res: Response) {
    try {
      const { message, sessionId, category } = req.body as SendMessageRequest;
      
      if (!message) {
        return res.status(400).json({
          status: false,
          msg: 'Message is required'
        });
      }
      
      if (!sessionId) {
        return res.status(400).json({
          status: false,
          msg: 'Session ID is required'
        });
      }
      
      // Get user ID from authenticated request
      const userId = req.user?.id || 'anonymous';
      
      // Process the message
      const response = await this.chatService.processMessage(
        userId,
        sessionId,
        message,
        category
      );
      
      return res.status(200).json({
        status: true,
        data: {
          response: response.response,
          sources: response.sources
        }
      });
    } catch (error: any) {
      console.error('Error processing message:', error);
      return res.status(500).json({
        status: false,
        msg: error.message || "An error occurred processing the message"
      });
    }
  }

  /**
   * Create a new chat session
   */
  async createChatSession(req: Request, res: Response) {
    try {
      const { title } = req.body as CreateSessionRequest;
      
      // Get user ID from authenticated request
      const userId = req.user?.id || 'anonymous';
      
      // Create a new session
      const sessionId = await this.chatService.createChatSession(userId, title);
      
      return res.status(200).json({
        status: true,
        data: { sessionId }
      });
    } catch (error: any) {
      console.error('Error creating chat session:', error);
      return res.status(500).json({
        status: false,
        msg: error.message || "An error occurred creating the chat session"
      });
    }
  }

  /**
   * Get chat history for a session
   */
  async getChatHistory(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        return res.status(400).json({
          status: false,
          msg: 'Session ID is required'
        });
      }
      
      // Get the raw history
      const history = await this.chatService.loadChatHistory(sessionId);
      
      // Parse the history string into an array of messages
      const messages: { user: string; ai: string }[] = [];
      const historyLines = history.split('\n');
      
      for (let i = 0; i < historyLines.length; i++) {
        const line = historyLines[i].trim();
        
        if (line.startsWith('User: ')) {
          const userMessage = line.substring(6);
          const aiLine = (i + 1 < historyLines.length && historyLines[i + 1].trim().startsWith('AI: ')) 
            ? historyLines[i + 1].trim().substring(4) 
            : '';
          
          messages.push({
            user: userMessage,
            ai: aiLine
          });
          
          if (aiLine) i++; // Skip the AI line we just processed
        }
      }
      
      return res.status(200).json({
        status: true,
        data: { messages }
      });
    } catch (error: any) {
      console.error('Error getting chat history:', error);
      return res.status(500).json({
        status: false,
        msg: error.message || "An error occurred retrieving chat history"
      });
    }
  }

  /**
   * Delete a chat session
   */
  async deleteChatSession(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        return res.status(400).json({
          status: false,
          msg: 'Session ID is required'
        });
      }
      
      // Get user ID from authenticated request
      const userId = req.user?.id || 'anonymous';
      
      // Delete the session
      const success = await this.chatService.deleteChatSession(userId, sessionId);
      
      if (success) {
        return res.status(200).json({
          status: true,
          msg: 'Chat session successfully deleted'
        });
      } else {
        return res.status(404).json({
          status: false,
          msg: 'Chat session not found or you do not have permission to delete it'
        });
      }
    } catch (error: any) {
      console.error('Error deleting chat session:', error);
      return res.status(500).json({
        status: false,
        msg: error.message || "An error occurred deleting the chat session"
      });
    }
  }

  /**
   * Get all chat sessions for the current user
   */
  async getUserChatSessions(req: Request, res: Response) {
    try {
      // Get user ID from authenticated request
      const userId = req.user?.id || 'anonymous';
      
      // Get all sessions for the user
      const sessions = await this.chatService.getUserChatSessions(userId);
      
      return res.status(200).json({
        status: true,
        data: { sessions }
      });
    } catch (error: any) {
      console.error('Error getting user chat sessions:', error);
      return res.status(500).json({
        status: false,
        msg: error.message || "An error occurred retrieving chat sessions"
      });
    }
  }

  /**
   * Start a chat session on a specific topic
   */
  async startTopicChat(req: Request, res: Response) {
    try {
      const { topic } = req.body as StartTopicRequest;
      
      if (!topic) {
        return res.status(400).json({
          status: false,
          msg: 'Topic is required'
        });
      }
      
      // Get user ID from authenticated request
      const userId = req.user?.id || 'anonymous';
      
      // Start a chat on the topic
      const result = await this.chatService.startTopicChat(userId, topic);
      
      return res.status(200).json({
        status: true,
        data: {
          sessionId: result.sessionId,
          initialResponse: result.initialResponse
        }
      });
    } catch (error: any) {
      console.error('Error starting topic chat:', error);
      return res.status(500).json({
        status: false,
        msg: error.message || "An error occurred starting the topic chat"
      });
    }
  }

  /**
   * Get predefined chat topics
   */
  async getChatTopics(req: Request, res: Response) {
    try {
      const topics = await this.chatService.getChatTopics();
      
      return res.status(200).json({
        status: true,
        data: { topics }
      });
    } catch (error: any) {
      console.error('Error getting chat topics:', error);
      return res.status(500).json({
        status: false,
        msg: error.message || "An error occurred retrieving chat topics"
      });
    }
  }

  /**
   * Create a new chat topic (admin only)
   */
  async createChatTopic(req: Request, res: Response) {
    try {
      const { title, description, icon, category, displayOrder } = req.body;
      
      if (!title) {
        return res.status(400).json({
          status: false,
          msg: 'Topic title is required'
        });
      }
      
      // Get admin ID from authenticated request
      const adminId = req.user?.id;
      
      // Create the topic
      const topicId = await this.chatService.createChatTopic({
        title,
        description: description || '',
        icon: icon || '',
        category: category || 'general',
        displayOrder: displayOrder || 0,
        createdBy: adminId
      });
      
      return res.status(201).json({
        status: true,
        msg: 'Chat topic created successfully',
        data: { topicId }
      });
    } catch (error: any) {
      console.error('Error creating chat topic:', error);
      return res.status(500).json({
        status: false,
        msg: error.message || "An error occurred creating the chat topic"
      });
    }
  }

  /**
   * Update an existing chat topic (admin only)
   */
  async updateChatTopic(req: Request, res: Response) {
    try {
      const { topicId } = req.params;
      const { title, description, icon, category, displayOrder } = req.body;
      
      if (!topicId) {
        return res.status(400).json({
          status: false,
          msg: 'Topic ID is required'
        });
      }
      
      // Update the topic
      const success = await this.chatService.updateChatTopic(topicId, {
        title,
        description,
        icon,
        category,
        displayOrder
      });
      
      if (success) {
        return res.status(200).json({
          status: true,
          msg: 'Chat topic updated successfully'
        });
      } else {
        return res.status(404).json({
          status: false,
          msg: 'Chat topic not found'
        });
      }
    } catch (error: any) {
      console.error('Error updating chat topic:', error);
      return res.status(500).json({
        status: false,
        msg: error.message || "An error occurred updating the chat topic"
      });
    }
  }

  /**
 * Generate a title for a chat session
 */
async generateChatTitle(req: Request, res: Response) {
    try {
      const { message, sessionId } = req.body;
      
      if (!message) {
        return res.status(400).json({
          status: false,
          msg: 'Message is required'
        });
      }
      
      if (!sessionId) {
        return res.status(400).json({
          status: false,
          msg: 'Session ID is required'
        });
      }
      
      // Get user ID from authenticated request
      const userId = req.user?.id || 'anonymous';
      
      // Generate title
      const title = await this.chatService.generateChatTitle(userId, sessionId, message);
      
      return res.status(200).json({
        status: true,
        data: { title }
      });
    } catch (error: any) {
      console.error('Error generating chat title:', error);
      return res.status(500).json({
        status: false,
        msg: error.message || "An error occurred generating the chat title"
      });
    }
  }
  
  /**
   * Update the title of a chat session
   */
  async updateChatTitle(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      const { title } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({
          status: false,
          msg: 'Session ID is required'
        });
      }
      
      if (!title) {
        return res.status(400).json({
          status: false,
          msg: 'Title is required'
        });
      }
      
      // Get user ID from authenticated request
      const userId = req.user?.id || 'anonymous';
      
      // Update title
      const success = await this.chatService.updateChatTitle(userId, sessionId, title);
      
      if (success) {
        return res.status(200).json({
          status: true,
          msg: "Chat title updated successfully"
        });
      } else {
        return res.status(404).json({
          status: false,
          msg: "Chat session not found or you do not have permission to update it"
        });
      }
    } catch (error: any) {
      console.error('Error updating chat title:', error);
      return res.status(500).json({
        status: false,
        msg: error.message || "An error occurred updating the chat title"
      });
    }
  }

/**
 * Get the last active chat session for the current user
 */
async getLastChatSession(req: Request, res: Response) {
  try {
    // Get user ID from authenticated request
    const userId = req.user?.id || 'anonymous';
    
    // Get the last chat session
    const sessionId = await this.chatService.getLastChatSession(userId);
    
    if (sessionId) {
      return res.status(200).json({
        status: true,
        data: { sessionId }
      });
    } else {
      return res.status(404).json({
        status: false,
        msg: 'No previous chat sessions found'
      });
    }
  } catch (error: any) {
    console.error('Error getting last chat session:', error);
    return res.status(500).json({
      status: false,
      msg: error.message || "An error occurred retrieving the last chat session"
    });
  }
}

  /**
   * Delete a chat topic (admin only)
   */
  async deleteChatTopic(req: Request, res: Response) {
    try {
      const { topicId } = req.params;
      
      if (!topicId) {
        return res.status(400).json({
          status: false,
          msg: 'Topic ID is required'
        });
      }
      
      // Delete the topic
      const success = await this.chatService.deleteChatTopic(topicId);
      
      if (success) {
        return res.status(200).json({
          status: true,
          msg: 'Chat topic deleted successfully'
        });
      } else {
        return res.status(404).json({
          status: false,
          msg: 'Chat topic not found'
        });
      }
    } catch (error: any) {
      console.error('Error deleting chat topic:', error);
      return res.status(500).json({
        status: false,
        msg: error.message || "An error occurred deleting the chat topic"
      });
    }
  }

  /**
   * Get chat usage analytics (admin only)
   */
  async getChatAnalytics(req: Request, res: Response) {
    try {
      // Get date range from query params
      const { startDate, endDate } = req.query;
      
      // Get analytics data
      const analytics = await this.chatService.getChatAnalytics(
        startDate as string, 
        endDate as string
      );
      
      return res.status(200).json({
        status: true,
        data: analytics
      });
    } catch (error: any) {
      console.error('Error getting chat analytics:', error);
      return res.status(500).json({
        status: false,
        msg: error.message || "An error occurred retrieving chat analytics"
      });
    }
  }
}

export default ChatController;