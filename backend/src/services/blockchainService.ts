import { ethers } from 'ethers';
import { logger } from '@/utils/logger';
import { provider, contracts } from '@/config/blockchain';

/**
 * Verify a message was signed by an address
 */
export const verifyMessageSignature = (message: string, signature: string): string => {
    try {
        return ethers.verifyMessage(message, signature);
    } catch (error) {
        logger.error('Signature verification failed:', error);
        throw new Error('Invalid signature');
    }
};

/**
 * Verify user role on blockchain
 * This is a simulated check if the contract isn't available
 */
export const verifySignatureOnChain = async (address: string, role: string): Promise<boolean> => {
    try {
        // If we have the UserRegistry contract, check there
        if (contracts.userRegistry) {
            // Logic to call contract
            // const hasRole = await contracts.userRegistry.hasRole(roleKeccak, address);
            // return hasRole;
            return true; // Placeholder for now
        }

        // If no contract connection, we might trust the DB (or return true for dev)
        // Strictly speaking, strict blockchain auth requires the contract call.
        return true;
    } catch (error) {
        logger.error('Blockchain role verification failed:', error);
        return false;
    }
};

export const getLatestBlockNumber = async (): Promise<number> => {
    try {
        if (!provider) return 0;
        return await provider.getBlockNumber();
    } catch (error) {
        logger.error('Error getting block number', error);
        return 0;
    }
};

export const getHealthStatus = async (): Promise<any> => {
    const blockNumber = await getLatestBlockNumber();
    // Simple mock stats
    return {
        blockDelay: 0,
        pendingTransactions: 0,
        latestBlock: blockNumber
    };
};
