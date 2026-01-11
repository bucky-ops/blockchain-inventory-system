import { Router } from 'express';
import { auditController } from '@/controllers/auditController';
import { asyncHandler } from '@/middleware/errorHandler';

const router = Router();

router.get('/', asyncHandler(auditController.getLogs));

export default router;
