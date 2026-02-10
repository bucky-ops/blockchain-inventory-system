import { Router } from 'express';
import { adminController } from '@/controllers/adminController';
import { asyncHandler } from '@/middleware/errorHandler';

const router = Router();

router.get('/stats', asyncHandler(adminController.getSystemStats));

export default router;
