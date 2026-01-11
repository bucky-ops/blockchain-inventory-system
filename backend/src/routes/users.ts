import { Router } from 'express';
import { userController } from '@/controllers/userController';
import { asyncHandler } from '@/middleware/errorHandler';
// import { requireRole } from '@/middleware/auth'; 

const router = Router();

// Assuming authMiddleware checks for authentication, we can add role checks here
// router.use(requireRole(['ADMIN', 'MANAGER']));

router.get('/', asyncHandler(userController.getUsers));

export default router;
