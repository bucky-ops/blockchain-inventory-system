import { ethers } from "ethers";
import { logger } from "@/utils/logger";
import { provider, contracts, wallet } from "@/config/blockchain";
import { databaseService } from "./databaseService";

// Contract ABIs (minimal versions for core functionality)
const INVENTORY_MANAGER_ABI = [
  "function createItem(string sku, string name, uint256 quantity, address owner) returns (uint256)",
  "function updateItem(uint256 itemId, uint256 newQuantity) returns (bool)",
  "function getItem(uint256 itemId) view returns (string sku, string name, uint256 quantity, address owner, bool active)",
  "function transferItem(uint256 itemId, address newOwner) returns (bool)",
  "function getItemCount() view returns (uint256)",
  "event ItemCreated(uint256 indexed itemId, string sku, address indexed owner)",
  "event ItemUpdated(uint256 indexed itemId, uint256 newQuantity)",
  "event ItemTransferred(uint256 indexed itemId, address indexed oldOwner, address indexed newOwner)",
];

const USER_REGISTRY_ABI = [
  "function registerUser(address walletAddress, string username, bytes32 role) returns (bool)",
  "function updateUserRole(address walletAddress, bytes32 newRole) returns (bool)",
  "function getUserRole(address walletAddress) view returns (bytes32)",
  "function isRegistered(address walletAddress) view returns (bool)",
  "function hasRole(bytes32 role, address walletAddress) view returns (bool)",
  "event UserRegistered(address indexed walletAddress, string username, bytes32 role)",
  "event RoleUpdated(address indexed walletAddress, bytes32 oldRole, bytes32 newRole)",
];

const AUDIT_LOGGER_ABI = [
  "function logAction(address indexed user, string action, string resourceType, bytes32 resourceId) returns (uint256)",
  "function getAuditLog(uint256 logId) view returns (address user, string action, string resourceType, bytes32 resourceId, uint256 timestamp)",
  "function getAuditLogsCount() view returns (uint256)",
  "event ActionLogged(address indexed user, string action, string resourceType, bytes32 resourceId, uint256 timestamp)",
];

// Role constants
const ROLES = {
  ADMIN: ethers.keccak256(ethers.toUtf8Bytes("ADMIN")),
  MANAGER: ethers.keccak256(ethers.toUtf8Bytes("MANAGER")),
  USER: ethers.keccak256(ethers.toUtf8Bytes("USER")),
  VIEWER: ethers.keccak256(ethers.toUtf8Bytes("VIEWER")),
};

class BlockchainService {
  private inventoryManager: ethers.Contract | null = null;
  private userRegistry: ethers.Contract | null = null;
  private auditLogger: ethers.Contract | null = null;

  constructor() {
    this.initializeContracts();
  }

  private initializeContracts(): void {
    try {
      if (provider && wallet) {
        // Initialize contracts with addresses from environment or config
        const inventoryAddress = process.env.CONTRACT_ADDRESS_INVENTORY_MANAGER;
        const userRegistryAddress = process.env.CONTRACT_ADDRESS_USER_REGISTRY;
        const auditLoggerAddress = process.env.CONTRACT_ADDRESS_AUDIT_LOGGER;

        if (inventoryAddress) {
          this.inventoryManager = new ethers.Contract(
            inventoryAddress,
            INVENTORY_MANAGER_ABI,
            wallet,
          );
          logger.info("Inventory Manager contract initialized");
        }

        if (userRegistryAddress) {
          this.userRegistry = new ethers.Contract(
            userRegistryAddress,
            USER_REGISTRY_ABI,
            wallet,
          );
          logger.info("User Registry contract initialized");
        }

        if (auditLoggerAddress) {
          this.auditLogger = new ethers.Contract(
            auditLoggerAddress,
            AUDIT_LOGGER_ABI,
            wallet,
          );
          logger.info("Audit Logger contract initialized");
        }
      }
    } catch (error) {
      logger.error("Failed to initialize blockchain contracts:", error);
    }
  }

  // Signature Verification
  public verifyMessageSignature(message: string, signature: string): string {
    try {
      return ethers.verifyMessage(message, signature);
    } catch (error) {
      logger.error("Signature verification failed:", error);
      throw new Error("Invalid signature");
    }
  }

  // User Registry Operations
  public async registerUser(
    walletAddress: string,
    username: string,
    role: string,
  ): Promise<string> {
    try {
      if (!this.userRegistry) {
        throw new Error("User Registry contract not initialized");
      }

      const roleBytes32 =
        ROLES[role.toUpperCase() as keyof typeof ROLES] || ROLES.USER;
      const tx = await this.userRegistry.registerUser(
        walletAddress,
        username,
        roleBytes32,
      );
      const receipt = await tx.wait();

      logger.info(
        `User registered on blockchain: ${walletAddress}, tx: ${tx.hash}`,
      );
      return tx.hash;
    } catch (error) {
      logger.error("Failed to register user on blockchain:", error);
      throw error;
    }
  }

  public async getUserRole(walletAddress: string): Promise<string | null> {
    try {
      if (!this.userRegistry) {
        return null;
      }

      const roleBytes32 = await this.userRegistry.getUserRole(walletAddress);

      // Convert bytes32 back to role string
      for (const [roleName, roleHash] of Object.entries(ROLES)) {
        if (roleHash === roleBytes32) {
          return roleName.toLowerCase();
        }
      }

      return null;
    } catch (error) {
      logger.error("Failed to get user role from blockchain:", error);
      return null;
    }
  }

  public async isRegistered(walletAddress: string): Promise<boolean> {
    try {
      if (!this.userRegistry) {
        return false;
      }

      return await this.userRegistry.isRegistered(walletAddress);
    } catch (error) {
      logger.error("Failed to check user registration on blockchain:", error);
      return false;
    }
  }

  public async hasRole(role: string, walletAddress: string): Promise<boolean> {
    try {
      if (!this.userRegistry) {
        return false;
      }

      const roleBytes32 = ROLES[role.toUpperCase() as keyof typeof ROLES];
      if (!roleBytes32) {
        return false;
      }

      return await this.userRegistry.hasRole(roleBytes32, walletAddress);
    } catch (error) {
      logger.error("Failed to check user role on blockchain:", error);
      return false;
    }
  }

  // Inventory Manager Operations
  public async createInventoryItem(
    sku: string,
    name: string,
    quantity: number,
    ownerAddress: string,
  ): Promise<string> {
    try {
      if (!this.inventoryManager) {
        throw new Error("Inventory Manager contract not initialized");
      }

      const tx = await this.inventoryManager.createItem(
        sku,
        name,
        quantity,
        ownerAddress,
      );
      const receipt = await tx.wait();

      // Get the item ID from the event
      const event = receipt.logs?.find((log) => {
        try {
          const parsed = this.inventoryManager!.interface.parseLog(log);
          return parsed.name === "ItemCreated";
        } catch {
          return false;
        }
      });

      const itemId = event ? event.args[0] : null;
      logger.info(
        `Inventory item created on blockchain: ${sku}, tx: ${tx.hash}, itemId: ${itemId}`,
      );

      return tx.hash;
    } catch (error) {
      logger.error("Failed to create inventory item on blockchain:", error);
      throw error;
    }
  }

  public async updateInventoryItem(
    itemId: string,
    newQuantity: number,
  ): Promise<string> {
    try {
      if (!this.inventoryManager) {
        throw new Error("Inventory Manager contract not initialized");
      }

      const tx = await this.inventoryManager.updateItem(itemId, newQuantity);
      const receipt = await tx.wait();

      logger.info(
        `Inventory item updated on blockchain: itemId ${itemId}, tx: ${tx.hash}`,
      );
      return tx.hash;
    } catch (error) {
      logger.error("Failed to update inventory item on blockchain:", error);
      throw error;
    }
  }

  public async transferInventoryItem(
    itemId: string,
    newOwnerAddress: string,
  ): Promise<string> {
    try {
      if (!this.inventoryManager) {
        throw new Error("Inventory Manager contract not initialized");
      }

      const tx = await this.inventoryManager.transferItem(
        itemId,
        newOwnerAddress,
      );
      const receipt = await tx.wait();

      logger.info(
        `Inventory item transferred on blockchain: itemId ${itemId}, tx: ${tx.hash}`,
      );
      return tx.hash;
    } catch (error) {
      logger.error("Failed to transfer inventory item on blockchain:", error);
      throw error;
    }
  }

  public async getInventoryItem(itemId: string): Promise<any | null> {
    try {
      if (!this.inventoryManager) {
        return null;
      }

      const item = await this.inventoryManager.getItem(itemId);
      return {
        sku: item[0],
        name: item[1],
        quantity: Number(item[2]),
        owner: item[3],
        active: item[4],
      };
    } catch (error) {
      logger.error("Failed to get inventory item from blockchain:", error);
      return null;
    }
  }

  // Audit Logger Operations
  public async logAction(
    userAddress: string,
    action: string,
    resourceType: string,
    resourceId: string,
  ): Promise<string> {
    try {
      if (!this.auditLogger) {
        throw new Error("Audit Logger contract not initialized");
      }

      const resourceIdBytes32 = ethers.keccak256(
        ethers.toUtf8Bytes(resourceId),
      );
      const tx = await this.auditLogger.logAction(
        userAddress,
        action,
        resourceType,
        resourceIdBytes32,
      );
      const receipt = await tx.wait();

      logger.info(`Action logged on blockchain: ${action}, tx: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      logger.error("Failed to log action on blockchain:", error);
      throw error;
    }
  }

  public async getAuditLog(logId: string): Promise<any | null> {
    try {
      if (!this.auditLogger) {
        return null;
      }

      const log = await this.auditLogger.getAuditLog(logId);
      return {
        user: log[0],
        action: log[1],
        resourceType: log[2],
        resourceId: log[3],
        timestamp: Number(log[4]),
      };
    } catch (error) {
      logger.error("Failed to get audit log from blockchain:", error);
      return null;
    }
  }

  // Blockchain Health and Status
  public async getLatestBlockNumber(): Promise<number> {
    try {
      if (!provider) return 0;
      return await provider.getBlockNumber();
    } catch (error) {
      logger.error("Error getting block number:", error);
      return 0;
    }
  }

  public async getHealthStatus(): Promise<any> {
    try {
      const blockNumber = await this.getLatestBlockNumber();
      const latestBlock = provider ? await provider.getBlock("latest") : null;

      return {
        blockDelay: 0,
        pendingTransactions: 0,
        latestBlock: blockNumber,
        networkConnected: !!provider,
        contractsInitialized: {
          inventoryManager: !!this.inventoryManager,
          userRegistry: !!this.userRegistry,
          auditLogger: !!this.auditLogger,
        },
        gasPrice: latestBlock?.baseFeePerGas
          ? Number(latestBlock.baseFeePerGas)
          : null,
        timestamp: latestBlock?.timestamp || null,
      };
    } catch (error) {
      logger.error("Error getting blockchain health status:", error);
      return {
        blockDelay: 0,
        pendingTransactions: 0,
        latestBlock: 0,
        networkConnected: false,
        contractsInitialized: {
          inventoryManager: false,
          userRegistry: false,
          auditLogger: false,
        },
        gasPrice: null,
        timestamp: null,
        error: error.message,
      };
    }
  }

  // Transaction Monitoring
  public async waitForTransaction(
    txHash: string,
    confirmations: number = 1,
  ): Promise<any> {
    try {
      if (!provider) {
        throw new Error("Provider not initialized");
      }

      const receipt = await provider.waitForTransaction(txHash, confirmations);
      return receipt;
    } catch (error) {
      logger.error("Error waiting for transaction:", error);
      throw error;
    }
  }

  public async getTransactionStatus(txHash: string): Promise<any> {
    try {
      if (!provider) {
        throw new Error("Provider not initialized");
      }

      const receipt = await provider.getTransactionReceipt(txHash);
      const tx = await provider.getTransaction(txHash);

      return {
        confirmed: !!receipt,
        blockNumber: receipt?.blockNumber || null,
        gasUsed: receipt?.gasUsed ? Number(receipt.gasUsed) : null,
        status: receipt?.status || null,
        pending: !receipt && tx,
        timestamp: receipt
          ? await this.getBlockTimestamp(receipt.blockNumber)
          : null,
      };
    } catch (error) {
      logger.error("Error getting transaction status:", error);
      return {
        confirmed: false,
        blockNumber: null,
        gasUsed: null,
        status: null,
        pending: false,
        timestamp: null,
        error: error.message,
      };
    }
  }

  private async getBlockTimestamp(blockNumber: number): Promise<number | null> {
    try {
      if (!provider) return null;
      const block = await provider.getBlock(blockNumber);
      return block?.timestamp || null;
    } catch (error) {
      return null;
    }
  }

  // Utility Methods
  public async getContractAddress(
    contractName: string,
  ): Promise<string | null> {
    switch (contractName.toLowerCase()) {
      case "inventorymanager":
        return (this.inventoryManager?.target as string) || null;
      case "userregistry":
        return (this.userRegistry?.target as string) || null;
      case "auditlogger":
        return (this.auditLogger?.target as string) || null;
      default:
        return null;
    }
  }

  public isContractInitialized(contractName: string): boolean {
    switch (contractName.toLowerCase()) {
      case "inventorymanager":
        return !!this.inventoryManager;
      case "userregistry":
        return !!this.userRegistry;
      case "auditlogger":
        return !!this.auditLogger;
      default:
        return false;
    }
  }
}

export const blockchainService = new BlockchainService();

// Export legacy functions for backward compatibility
export const verifyMessageSignature = (
  message: string,
  signature: string,
): string => {
  return blockchainService.verifyMessageSignature(message, signature);
};

export const verifySignatureOnChain = async (
  address: string,
  role: string,
): Promise<boolean> => {
  return await blockchainService.hasRole(role, address);
};

export const getLatestBlockNumber = async (): Promise<number> => {
  return await blockchainService.getLatestBlockNumber();
};

export const getHealthStatus = async (): Promise<any> => {
  return await blockchainService.getHealthStatus();
};
