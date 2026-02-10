import { Request, Response } from 'express';
import { getAllUsers, getUserByAddress } from '@/services/userService';
import { AuthenticatedRequest } from '@/middleware/errorHandler';

export class UserController {
    /**
     * Get all users (paginated)
     */
    public getUsers = async (req: Request, res: Response): Promise<void> => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            const result = await getAllUsers(page, limit);

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Get current user
     */
    public getMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        // This is handled by authController.getProfile but kept here for consistency if needed
        // or for getting another user by ID
        res.json({ success: true, message: 'Use /auth/me' });
    };
}

export const userController = new UserController();
