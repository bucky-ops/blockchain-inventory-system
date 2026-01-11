import { Request, Response } from 'express';
import { getAuditLogs } from '@/services/auditService';

export class AuditController {
    public getLogs = async (req: Request, res: Response): Promise<void> => {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;

        const logs = await getAuditLogs(page, limit);

        res.json({
            success: true,
            data: logs
        });
    };
}

export const auditController = new AuditController();
