import { Request, Response } from 'express';
import * as inventoryService from '@/services/inventoryService';
import { ValidationError, NotFoundError } from '@/middleware/errorHandler';

export class InventoryController {
    public getAll = async (req: Request, res: Response): Promise<void> => {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const search = req.query.search as string;

        const result = await inventoryService.getInventoryItems(page, limit, search);

        res.json({
            success: true,
            data: result
        });
    };

    public getOne = async (req: Request, res: Response): Promise<void> => {
        const id = req.params.id;
        const item = await inventoryService.getInventoryItemById(id);

        if (!item) {
            throw new NotFoundError('Item not found');
        }

        res.json({
            success: true,
            data: item
        });
    };

    public create = async (req: Request, res: Response): Promise<void> => {
        const item = await inventoryService.createInventoryItem(req.body);

        res.status(201).json({
            success: true,
            data: item
        });
    };

    public update = async (req: Request, res: Response): Promise<void> => {
        const id = req.params.id;
        const item = await inventoryService.updateInventoryItem(id, req.body);

        if (!item) {
            throw new NotFoundError('Item not found');
        }

        res.json({
            success: true,
            data: item
        });
    };

    public delete = async (req: Request, res: Response): Promise<void> => {
        const id = req.params.id;
        const success = await inventoryService.deleteInventoryItem(id);

        if (!success) {
            throw new NotFoundError('Item not found');
        }

        res.json({
            success: true,
            message: 'Item deleted successfully'
        });
    };
}

export const inventoryController = new InventoryController();
