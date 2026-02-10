import { Router } from 'express';
import { body } from 'express-validator';
import { inventoryController } from '@/controllers/inventoryController';
import { asyncHandler } from '@/middleware/errorHandler';
// import { requireRole } from '@/middleware/auth';

const router = Router();

router.get('/', asyncHandler(inventoryController.getAll));
router.get('/:id', asyncHandler(inventoryController.getOne));

router.post(
    '/',
    [
        body('sku').notEmpty().withMessage('SKU is required'),
        body('name').notEmpty().withMessage('Name is required'),
        body('quantity').isNumeric().withMessage('Quantity must be a number')
    ],
    asyncHandler(inventoryController.create)
);

router.put('/:id', asyncHandler(inventoryController.update));
router.delete('/:id', asyncHandler(inventoryController.delete));

export default router;
