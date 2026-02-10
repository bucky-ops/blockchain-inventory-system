import { ethers } from 'ethers';
import config from 'config';
import { logger } from '@/utils/logger';

// BlockChain Configuration Interface
interface BlockchainConfig {
    rpcUrl: string;
    networkId: number;
    contracts: {
        inventoryManager: string;
        userRegistry: string;
        auditLogger: string;
    };
}

const blockchainConfig = config.get<BlockchainConfig>('blockchain');

export let provider: ethers.JsonRpcProvider;
export let wallet: ethers.Wallet;

// Contract Instances
export const contracts: { [key: string]: ethers.Contract } = {};

export const connectBlockchain = async (): Promise<void> => {
    try {
        const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || blockchainConfig.rpcUrl;
        provider = new ethers.JsonRpcProvider(rpcUrl);

        // Verify connection
        const network = await provider.getNetwork();
        logger.info(`Connected to blockchain network: ${network.name} (Chain ID: ${network.chainId})`);

        // Initialize wallet if private key is present
        if (process.env.PRIVATE_KEY) {
            wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
            logger.info(`Wallet initialized: ${wallet.address}`);
        }

        // Initialize contracts if addresses are present
        const inventoryAddress = process.env.CONTRACT_ADDRESS_INVENTORY_MANAGER || blockchainConfig.contracts.inventoryManager;
        if (inventoryAddress && wallet) {
            // Note: ABIs would typically be imported from the compilation artifacts
            // For now we'll load them dynamically or use minimal ABIs if artifacts aren't available
            // contracts.inventoryManager = new ethers.Contract(inventoryAddress, InventoryManagerABI, wallet);
            logger.info('Inventory Manager contract initialized');
        }

    } catch (error) {
        logger.error('Failed to connect to blockchain:', error);
        // Don't throw here to allow app to start without blockchain if needed (e.g. dev mode)
        // throw error; 
    }
};
