import { ethers } from "ethers";
import { logger } from "@/utils/logger";
import { provider, contracts, wallet } from "@/config/blockchain";
import { databaseService } from "./databaseService";

// Contract ABIs (accurate versions matching actual smart contracts)
const INVENTORY_MANAGER_ABI = [
  "function ADMIN_ROLE() view returns (bytes32)",
  "function MANAGER_ROLE() view returns (bytes32)",
  "function OPERATOR_ROLE() view returns (bytes32)",
  "function VIEWER_ROLE() view returns (bytes32)",
  "function inventoryItems(uint256) view returns (uint256 id, string sku, string name, string description, string category, uint256 quantity, string location, address creator, uint256 createdAt, uint256 lastUpdated, bool isActive, string metadataHash)",
  "function skuToItemId(string) view returns (uint256)",
  "function locationExists(string) view returns (bool)",
  "function createItem(string memory sku, string memory name, string memory description, string memory category, uint256 quantity, string memory location, string memory metadataHash) external returns (uint256)",
  "function updateQuantity(uint256 itemId, uint256 newQuantity, string memory reason) external",
  "function transferItem(uint256 itemId, string memory toLocation, uint256 quantity, string memory reason) external",
  "function deleteItem(uint256 itemId, string memory reason) external",
  "function batchCreateItems(string[] memory skus, string[] memory names, string[] memory descriptions, string[] memory categories, uint256[] memory quantities, string[] memory locations, string[] memory metadataHashes) external returns (uint256[] memory)",
  "function getItem(uint256 itemId) external view returns (tuple(uint256 id, string sku, string name, string description, string category, uint256 quantity, string location, address creator, uint256 createdAt, uint256 lastUpdated, bool isActive, string metadataHash) memory)",
  "function getAllActiveItems() external view returns (tuple(uint256 id, string sku, string name, string description, string category, uint256 quantity, string location, address creator, uint256 createdAt, uint256 lastUpdated, bool isActive, string metadataHash)[] memory)",
  "function getItemTransactions(uint256 itemId) external view returns (tuple(uint256 id, uint256 itemId, address fromAddress, address toAddress, string action, uint256 quantity, string fromLocation, string toLocation, string reason, address executor, uint256 timestamp, bytes32 transactionHash)[] memory)",
  "function getTotalItems() external view returns (uint256)",
  "function getItemsByLocation(string memory location) external view returns (tuple(uint256 id, string sku, string name, string description, string category, uint256 quantity, string location, address creator, uint256 createdAt, uint256 lastUpdated, bool isActive, string metadataHash)[] memory)",
  "function pause() external",
  "function unpause() external",
  "event ItemCreated(uint256 indexed itemId, string indexed sku, string name, uint256 quantity, string location, address indexed creator, uint256 timestamp)",
  "event ItemUpdated(uint256 indexed itemId, uint256 oldQuantity, uint256 newQuantity, address indexed updater, uint256 timestamp)",
  "event ItemTransferred(uint256 indexed itemId, string fromLocation, string toLocation, uint256 quantity, address indexed executor, uint256 timestamp)",
  "event ItemDeleted(uint256 indexed itemId, address indexed deleter, uint256 timestamp, string reason)",
  "event TransactionLogged(uint256 indexed transactionId, uint256 indexed itemId, address indexed executor, string action, uint256 timestamp)"
];

const USER_REGISTRY_ABI = [
  "function ADMIN_ROLE() view returns (bytes32)",
  "function MANAGER_ROLE() view returns (bytes32)",
  "function AUDITOR_ROLE() view returns (bytes32)",
  "function VIEWER_ROLE() view returns (bytes32)",
  "function users(address) view returns (uint256 id, address walletAddress, string email, string fullName, bytes32 role, uint8 status, uint256 createdAt, uint256 lastLogin, bool exists)",
  "function emailToAddress(string) view returns (address)",
  "function registerUser(address walletAddress, string memory email, string memory fullName, bytes32 role, string memory reason) external returns (uint256)",
  "function updateUserRole(address walletAddress, bytes32 newRole, string memory reason) external",
  "function suspendUser(address walletAddress, string memory reason) external",
  "function reactivateUser(address walletAddress, string memory reason) external",
  "function recordLoginAttempt(address walletAddress, bool success, string memory ipAddress, string memory userAgent) external",
  "function createLoginSession(address walletAddress, uint256 expiryTime, string memory userAgent, string memory ipAddress) external returns (uint256)",
  "function expireLoginSession(uint256 sessionId) external",
  "function getUser(address walletAddress) external view returns (tuple(uint256 id, address walletAddress, string email, string fullName, bytes32 role, uint8 status, uint256 createdAt, uint256 lastLogin, bool exists) memory)",
  "function getUserByEmail(string memory email) external view returns (tuple(uint256 id, address walletAddress, string email, string fullName, bytes32 role, uint8 status, uint256 createdAt, uint256 lastLogin, bool exists) memory)",
  "function hasRole(bytes32 role, address account) external view returns (bool)",
  "function getUsersByRole(bytes32 role) external view returns (address[] memory)",
  "function getUserActiveSessions(address walletAddress) external view returns (uint256[] memory)",
  "function getTotalUsers() external view returns (uint256)",
  "function pause() external",
  "function unpause() external",
  "event UserRegistered(uint256 indexed userId, address indexed walletAddress, string indexed email, bytes32 role, address registeredBy, uint256 timestamp)",
  "event UserUpdated(uint256 indexed userId, address indexed walletAddress, bytes32 oldRole, bytes32 newRole, address updatedBy, uint256 timestamp)",
  "event UserSuspended(uint256 indexed userId, address indexed walletAddress, string reason, address suspendedBy, uint256 timestamp)",
  "event UserReactivated(uint256 indexed userId, address indexed walletAddress, address reactivatedBy, uint256 timestamp)",
  "event LoginAttempt(address indexed walletAddress, bool success, string ipAddress, string userAgent, uint256 timestamp)",
  "event LoginSessionCreated(uint256 indexed sessionId, address indexed userAddress, uint256 expiryTime, uint256 timestamp)",
  "event LoginSessionExpired(uint256 indexed sessionId, address indexed userAddress, uint256 timestamp)"
];

const AUDIT_LOGGER_ABI = [
  "function ADMIN_ROLE() view returns (bytes32)",
  "function AUDITOR_ROLE() view returns (bytes32)",
  "function auditLogs(uint256) view returns (uint256 id, bytes32 eventType, uint8 severity, address actor, string action, string resource, string details, bytes32 dataHash, uint256 timestamp, uint256 blockNumber, bool isActive)",
  "function logAuditEvent(bytes32 eventType, uint8 severity, address actor, string memory action, string memory resource, string memory details, bytes32 dataHash) external returns (uint256)",
  "function generateComplianceReport(string memory reportType, uint256 startTime, uint256 endTime, string memory filters) external returns (uint256)",
  "function getUserAuditLogs(address user) external view returns (tuple(uint256 id, bytes32 eventType, uint8 severity, address actor, string action, string resource, string details, bytes32 dataHash, uint256 timestamp, uint256 blockNumber, bool isActive)[] memory)",
  "function getAuditLogsByEventType(bytes32 eventType) external view returns (tuple(uint256 id, bytes32 eventType, uint8 severity, address actor, string action, string resource, string details, bytes32 dataHash, uint256 timestamp, uint256 blockNumber, bool isActive)[] memory)",
  "function getAuditLogsBySeverity(uint8 severity) external view returns (tuple(uint256 id, bytes32 eventType, uint8 severity, address actor, string action, string resource, string details, bytes32 dataHash, uint256 timestamp, uint256 blockNumber, bool isActive)[] memory)",
  "function getAuditLogsByTimeRange(uint256 startTime, uint256 endTime) external view returns (tuple(uint256 id, bytes32 eventType, uint8 severity, address actor, string action, string resource, string details, bytes32 dataHash, uint256 timestamp, uint256 blockNumber, bool isActive)[] memory)",
  "function getRecentAuditLogs(uint256 limit) external view returns (tuple(uint256 id, bytes32 eventType, uint8 severity, address actor, string action, string resource, string details, bytes32 dataHash, uint256 timestamp, uint256 blockNumber, bool isActive)[] memory)",
  "function getComplianceReport(uint256 reportId) external view returns (tuple(uint256 id, string reportType, uint256 startTime, uint256 endTime, bytes32 reportHash, address generatedBy, uint256 generatedAt, bool isActive) memory)",
  "function getAllComplianceReports() external view returns (tuple(uint256 id, string reportType, uint256 startTime, uint256 endTime, bytes32 reportHash, address generatedBy, uint256 generatedAt, bool isActive)[] memory)",
  "function getAuditStatistics() external view returns (uint256 totalLogs, uint256 criticalLogs, uint256 highLogs, uint256 mediumLogs, uint256 lowLogs)",
  "function archiveAuditLog(uint256 logId) external",
  "function getTotalAuditLogs() external view returns (uint256)",
  "function getTotalComplianceReports() external view returns (uint256)",
  "function pause() external",
  "function unpause() external",
  "event AuditLogged(uint256 indexed logId, bytes32 indexed eventType, address indexed actor, uint8 severity, string action, uint256 timestamp)",
  "event ComplianceReportGenerated(uint256 indexed reportId, string indexed reportType, address indexed generator, uint256 timestamp)",
  "event SecurityAlert(uint256 indexed logId, address indexed actor, string alertType, uint256 timestamp)"
];

// Role constants - matching actual smart contract definitions
const ROLES = {
  ADMIN_ROLE: ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE")),
  MANAGER_ROLE: ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE")),
  OPERATOR_ROLE: ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE")),
  AUDITOR_ROLE: ethers.keccak256(ethers.toUtf8Bytes("AUDITOR_ROLE")),
  VIEWER_ROLE: ethers.keccak256(ethers.toUtf8Bytes("VIEWER_ROLE")),
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

      // Map role names to match contract role names
      let contractRole: string;
      switch (role.toUpperCase()) {
        case 'ADMIN':
          contractRole = 'ADMIN_ROLE';
          break;
        case 'MANAGER':
          contractRole = 'MANAGER_ROLE';
          break;
        case 'OPERATOR':
          contractRole = 'OPERATOR_ROLE';
          break;
        case 'AUDITOR':
          contractRole = 'AUDITOR_ROLE';
          break;
        case 'VIEWER':
          contractRole = 'VIEWER_ROLE';
          break;
        default:
          contractRole = role.toUpperCase();
          break;
      }

      const roleBytes32 = ROLES[`${contractRole}` as keyof typeof ROLES];
      if (!roleBytes32) {
        throw new Error(`Invalid role: ${role}`);
      }

      const tx = await this.userRegistry.registerUser(
        walletAddress,
        username,
        roleBytes32,
        "Registration via API"
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
          // Map contract role names back to expected role names
          switch (roleName) {
            case 'ADMIN_ROLE':
              return 'admin';
            case 'MANAGER_ROLE':
              return 'manager';
            case 'OPERATOR_ROLE':
              return 'operator';
            case 'AUDITOR_ROLE':
              return 'auditor';
            case 'VIEWER_ROLE':
              return 'viewer';
            default:
              return roleName.toLowerCase();
          }
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

  public async hasRole(walletAddress: string, role: string): Promise<boolean> {
    try {
      if (!this.userRegistry) {
        return false;
      }

      // Map role names to match contract role names
      let contractRole: string;
      switch (role.toUpperCase()) {
        case 'ADMIN':
          contractRole = 'ADMIN_ROLE';
          break;
        case 'MANAGER':
          contractRole = 'MANAGER_ROLE';
          break;
        case 'OPERATOR':
          contractRole = 'OPERATOR_ROLE';
          break;
        case 'AUDITOR':
          contractRole = 'AUDITOR_ROLE';
          break;
        case 'VIEWER':
          contractRole = 'VIEWER_ROLE';
          break;
        default:
          contractRole = role.toUpperCase();
          break;
      }

      const roleBytes32 = ROLES[`${contractRole}` as keyof typeof ROLES];
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
    description: string,
    category: string,
    quantity: number,
    location: string,
    metadataHash: string,
    ownerAddress: string,
  ): Promise<string> {
    try {
      if (!this.inventoryManager) {
        throw new Error("Inventory Manager contract not initialized");
      }

      const tx = await this.inventoryManager.createItem(
        sku,
        name,
        description,
        category,
        quantity,
        location,
        metadataHash
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
    reason: string,
  ): Promise<string> {
    try {
      if (!this.inventoryManager) {
        throw new Error("Inventory Manager contract not initialized");
      }

      const tx = await this.inventoryManager.updateQuantity(itemId, newQuantity, reason);
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
    toLocation: string,
    quantity: number,
    reason: string,
  ): Promise<string> {
    try {
      if (!this.inventoryManager) {
        throw new Error("Inventory Manager contract not initialized");
      }

      const tx = await this.inventoryManager.transferItem(
        itemId,
        toLocation,
        quantity,
        reason
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
        id: Number(item.id),
        sku: item.sku,
        name: item.name,
        description: item.description,
        category: item.category,
        quantity: Number(item.quantity),
        location: item.location,
        creator: item.creator,
        createdAt: Number(item.createdAt),
        lastUpdated: Number(item.lastUpdated),
        isActive: item.isActive,
        metadataHash: item.metadataHash,
      };
    } catch (error) {
      logger.error("Failed to get inventory item from blockchain:", error);
      return null;
    }
  }

  // Audit Logger Operations
  public async logAction(
    eventType: string,
    severity: number,
    userAddress: string,
    action: string,
    resource: string,
    details: string,
    dataHash: string,
  ): Promise<string> {
    try {
      if (!this.auditLogger) {
        throw new Error("Audit Logger contract not initialized");
      }

      // Convert event type to bytes32
      const eventTypeBytes32 = ethers.keccak256(ethers.toUtf8Bytes(eventType));
      
      const tx = await this.auditLogger.logAuditEvent(
        eventTypeBytes32,
        severity,
        userAddress,
        action,
        resource,
        details,
        dataHash
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
        id: Number(log.id),
        eventType: log.eventType,
        severity: Number(log.severity),
        actor: log.actor,
        action: log.action,
        resource: log.resource,
        details: log.details,
        dataHash: log.dataHash,
        timestamp: Number(log.timestamp),
        blockNumber: Number(log.blockNumber),
        isActive: log.isActive,
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

export const hasRole = async (
  address: string,
  role: string,
): Promise<boolean> => {
  return await blockchainService.hasRole(address, role);
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
