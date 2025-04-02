// src/routes/chat.routes.ts

import express, { Request, Response } from 'express';

import AuthMiddleware from '../middleware/auth.middleware.js';
import AdminMiddleware from '../middleware/admin.middleware.js';
import ChatController from '../controllers/chat.controller.js';

const router = express.Router();
const chatController = new ChatController();
const authMiddleware = new AuthMiddleware();
const adminMiddleware = new AdminMiddleware();

// Send a message to the chatbot (requires authentication)
router.post('/message', 
  authMiddleware.requireAuth, 
  (req: Request, res: Response) => {
    chatController.sendMessage(req, res);
  }
);

// Create a new chat session
router.post('/session', 
  authMiddleware.requireAuth, 
  (req: Request, res: Response) => {
    chatController.createChatSession(req, res);
  }
);

// Get chat history for a specific session
router.get('/session/:sessionId/history', 
  authMiddleware.requireAuth, 
  (req: Request, res: Response) => {
    chatController.getChatHistory(req, res);
  }
);

// Delete a chat session
router.delete('/session/:sessionId', 
  authMiddleware.requireAuth, 
  (req: Request, res: Response) => {
    chatController.deleteChatSession(req, res);
  }
);

// Generate a title for a chat session
router.post('/generate-title', 
  authMiddleware.requireAuth, 
  (req: Request, res: Response) => {
    chatController.generateChatTitle(req, res);
  }
);

// Update the title of a chat session
router.put('/session/:sessionId/title', 
  authMiddleware.requireAuth, 
  (req: Request, res: Response) => {
    chatController.updateChatTitle(req, res);
  }
);

// Get all chat sessions for the current user
router.get('/sessions', 
  authMiddleware.requireAuth, 
  (req: Request, res: Response) => {
    chatController.getUserChatSessions(req, res);
  }
);

router.get('/session/last', 
  authMiddleware.requireAuth, 
  (req: Request, res: Response) => {
    chatController.getLastChatSession(req, res);
  }
);

// Start a chat session on a specific topic
router.post('/topic', 
  authMiddleware.requireAuth, 
  (req: Request, res: Response) => {
    chatController.startTopicChat(req, res);
  }
);

// Get list of predefined chat topics
router.get('/topics', 
  (req: Request, res: Response) => {
    chatController.getChatTopics(req, res);
  }
);

// Admin routes for managing chat topics
router.post('/admin/topics', 
  authMiddleware.requireAuth, 
  adminMiddleware.requireAdmin, 
  (req: Request, res: Response) => {
    chatController.createChatTopic(req, res);
  }
);

router.put('/admin/topics/:topicId', 
  authMiddleware.requireAuth, 
  adminMiddleware.requireAdmin, 
  (req: Request, res: Response) => {
    chatController.updateChatTopic(req, res);
  }
);

router.delete('/admin/topics/:topicId', 
  authMiddleware.requireAuth, 
  adminMiddleware.requireAdmin, 
  (req: Request, res: Response) => {
    chatController.deleteChatTopic(req, res);
  }
);

// Get analytics for admin dashboard
router.get('/admin/analytics', 
  authMiddleware.requireAuth, 
  adminMiddleware.requireAdmin, 
  (req: Request, res: Response) => {
    chatController.getChatAnalytics(req, res);
  }
);

export default router;







// // src/routes/chat.routes.ts

// import express, { Request, Response } from 'express';

// import AuthMiddleware from '../middleware/auth.middleware.js';
// import AdminMiddleware from '../middleware/admin.middleware.js';
// import ChatController from '../controllers/chat.controller.js';

// const router = express.Router();
// const chatController = new ChatController();
// const authMiddleware = new AuthMiddleware();
// const adminMiddleware = new AdminMiddleware();

// // Send a message to the chatbot (requires authentication)
// router.post('/message', 
//   authMiddleware.requireAuth, 
//   (req: Request, res: Response) => {
//     chatController.sendMessage(req, res);
//   }
// );

// // Create a new chat session
// router.post('/session', 
//   authMiddleware.requireAuth, 
//   (req: Request, res: Response) => {
//     chatController.createChatSession(req, res);
//   }
// );

// // Get chat history for a specific session
// router.get('/session/:sessionId/history', 
//   authMiddleware.requireAuth, 
//   (req: Request, res: Response) => {
//     chatController.getChatHistory(req, res);
//   }
// );

// // Delete a chat session
// router.delete('/session/:sessionId', 
//   authMiddleware.requireAuth, 
//   (req: Request, res: Response) => {
//     chatController.deleteChatSession(req, res);
//   }
// );

// // Get all chat sessions for the current user
// router.get('/sessions', 
//   authMiddleware.requireAuth, 
//   (req: Request, res: Response) => {
//     chatController.getUserChatSessions(req, res);
//   }
// );

// // Start a chat session on a specific topic
// router.post('/topic', 
//   authMiddleware.requireAuth, 
//   (req: Request, res: Response) => {
//     chatController.startTopicChat(req, res);
//   }
// );

// // Get list of predefined chat topics
// router.get('/topics', 
//   (req: Request, res: Response) => {
//     chatController.getChatTopics(req, res);
//   }
// );

// // Admin routes for managing chat topics
// router.post('/admin/topics', 
//   authMiddleware.requireAuth, 
//   adminMiddleware.requireAdmin, 
//   (req: Request, res: Response) => {
//     chatController.createChatTopic(req, res);
//   }
// );

// router.put('/admin/topics/:topicId', 
//   authMiddleware.requireAuth, 
//   adminMiddleware.requireAdmin, 
//   (req: Request, res: Response) => {
//     chatController.updateChatTopic(req, res);
//   }
// );

// router.delete('/admin/topics/:topicId', 
//   authMiddleware.requireAuth, 
//   adminMiddleware.requireAdmin, 
//   (req: Request, res: Response) => {
//     chatController.deleteChatTopic(req, res);
//   }
// );

// // Get analytics for admin dashboard
// router.get('/admin/analytics', 
//   authMiddleware.requireAuth, 
//   adminMiddleware.requireAdmin, 
//   (req: Request, res: Response) => {
//     chatController.getChatAnalytics(req, res);
//   }
// );

// export default router;