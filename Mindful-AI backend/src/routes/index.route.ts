// src/routes/index.ts

import { Router } from 'express';
import authRoutes from './auth.route.js';
import chatRoutes from './chat.route.js';
import documentRoutes from './document.route.js';
// Import other route modules as needed

const router = Router();

// Mount route modules
router.use('/auth', authRoutes);
router.use('/chat', chatRoutes);
router.use('/document', documentRoutes);
// Mount other route modules
// router.use('/users', userRoutes);
// router.use('/other-resource', otherResourceRoutes);

export default router;