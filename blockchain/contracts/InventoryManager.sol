// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title InventoryManager
 * @dev Core contract for managing inventory items on blockchain
 * @notice Provides immutable tracking of inventory operations with role-based access control
 */
contract InventoryManager is AccessControl, ReentrancyGuard, Pausable {
    using Counters for Counters.Counter;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant VIEWER_ROLE = keccak256("VIEWER_ROLE");

    // State variables
    Counters.Counter private _itemIds;
    Counters.Counter private _transactionIds;
    
    // Item structure
    struct InventoryItem {
        uint256 id;
        string sku;
        string name;
        string description;
        string category;
        uint256 quantity;
        string location;
        address creator;
        uint256 createdAt;
        uint256 lastUpdated;
        bool isActive;
        string metadataHash; // IPFS hash or similar
    }

    // Transaction structure
    struct Transaction {
        uint256 id;
        uint256 itemId;
        address fromAddress;
        address toAddress;
        string action; // CREATE, UPDATE, TRANSFER, DELETE
        uint256 quantity;
        string fromLocation;
        string toLocation;
        string reason;
        address executor;
        uint256 timestamp;
        bytes32 transactionHash;
    }

    // Mappings
    mapping(uint256 => InventoryItem) public inventoryItems;
    mapping(uint256 => Transaction[]) public itemTransactions;
    mapping(string => uint256) public skuToItemId;
    mapping(address => uint256[]) public userTransactions;
    mapping(string => bool) public locationExists;
    
    // Events
    event ItemCreated(
        uint256 indexed itemId,
        string indexed sku,
        string name,
        uint256 quantity,
        string location,
        address indexed creator,
        uint256 timestamp
    );

    event ItemUpdated(
        uint256 indexed itemId,
        uint256 oldQuantity,
        uint256 newQuantity,
        address indexed updater,
        uint256 timestamp
    );

    event ItemTransferred(
        uint256 indexed itemId,
        string fromLocation,
        string toLocation,
        uint256 quantity,
        address indexed executor,
        uint256 timestamp
    );

    event ItemDeleted(
        uint256 indexed itemId,
        address indexed deleter,
        uint256 timestamp,
        string reason
    );

    event TransactionLogged(
        uint256 indexed transactionId,
        uint256 indexed itemId,
        address indexed executor,
        string action,
        uint256 timestamp
    );

    // Modifiers
    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "InventoryManager: caller is not admin");
        _;
    }

    modifier onlyManagerOrAbove() {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || hasRole(MANAGER_ROLE, msg.sender),
            "InventoryManager: caller is not manager or admin"
        );
        _;
    }

    modifier onlyOperatorOrAbove() {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || 
            hasRole(MANAGER_ROLE, msg.sender) || 
            hasRole(OPERATOR_ROLE, msg.sender),
            "InventoryManager: caller is not operator or above"
        );
        _;
    }

    modifier itemExists(uint256 itemId) {
        require(itemId > 0 && itemId <= _itemIds.current(), "InventoryManager: item does not exist");
        require(inventoryItems[itemId].isActive, "InventoryManager: item is not active");
        _;
    }

    modifier skuNotExists(string memory sku) {
        require(skuToItemId[sku] == 0, "InventoryManager: SKU already exists");
        _;
    }

    constructor(address defaultAdmin) {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(ADMIN_ROLE, defaultAdmin);
        _setRoleAdmin(ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(MANAGER_ROLE, ADMIN_ROLE);
        _setRoleAdmin(OPERATOR_ROLE, MANAGER_ROLE);
        _setRoleAdmin(VIEWER_ROLE, OPERATOR_ROLE);
    }

    /**
     * @dev Creates a new inventory item
     * @param sku Stock Keeping Unit
     * @param name Item name
     * @param description Item description
     * @param category Item category
     * @param quantity Initial quantity
     * @param location Storage location
     * @param metadataHash IPFS hash for metadata
     */
    function createItem(
        string memory sku,
        string memory name,
        string memory description,
        string memory category,
        uint256 quantity,
        string memory location,
        string memory metadataHash
    ) external onlyOperatorOrAbove whenNotPaused skuNotExists(sku) returns (uint256) {
        require(bytes(name).length > 0, "InventoryManager: name cannot be empty");
        require(bytes(sku).length > 0, "InventoryManager: SKU cannot be empty");
        require(quantity > 0, "InventoryManager: quantity must be positive");

        _itemIds.increment();
        uint256 newItemId = _itemIds.current();

        inventoryItems[newItemId] = InventoryItem({
            id: newItemId,
            sku: sku,
            name: name,
            description: description,
            category: category,
            quantity: quantity,
            location: location,
            creator: msg.sender,
            createdAt: block.timestamp,
            lastUpdated: block.timestamp,
            isActive: true,
            metadataHash: metadataHash
        });

        skuToItemId[sku] = newItemId;
        locationExists[location] = true;

        // Create transaction record
        _createTransaction(
            newItemId,
            msg.sender,
            address(0),
            "CREATE",
            quantity,
            "",
            location,
            "Initial item creation"
        );

        emit ItemCreated(newItemId, sku, name, quantity, location, msg.sender, block.timestamp);
        return newItemId;
    }

    /**
     * @dev Updates item quantity
     * @param itemId Item ID
     * @param newQuantity New quantity
     * @param reason Update reason
     */
    function updateQuantity(
        uint256 itemId,
        uint256 newQuantity,
        string memory reason
    ) external onlyOperatorOrAbove whenNotPaused itemExists(itemId) {
        uint256 oldQuantity = inventoryItems[itemId].quantity;
        require(newQuantity != oldQuantity, "InventoryManager: quantity unchanged");

        inventoryItems[itemId].quantity = newQuantity;
        inventoryItems[itemId].lastUpdated = block.timestamp;

        _createTransaction(
            itemId,
            msg.sender,
            address(0),
            "UPDATE",
            newQuantity,
            "",
            inventoryItems[itemId].location,
            reason
        );

        emit ItemUpdated(itemId, oldQuantity, newQuantity, msg.sender, block.timestamp);
    }

    /**
     * @dev Transfers items between locations
     * @param itemId Item ID
     * @param toLocation Destination location
     * @param quantity Transfer quantity
     * @param reason Transfer reason
     */
    function transferItem(
        uint256 itemId,
        string memory toLocation,
        uint256 quantity,
        string memory reason
    ) external onlyOperatorOrAbove whenNotPaused itemExists(itemId) {
        require(quantity > 0, "InventoryManager: quantity must be positive");
        require(
            quantity <= inventoryItems[itemId].quantity,
            "InventoryManager: insufficient quantity"
        );
        require(bytes(toLocation).length > 0, "InventoryManager: destination location required");

        string memory fromLocation = inventoryItems[itemId].location;
        
        // Update item quantity and location
        inventoryItems[itemId].quantity = inventoryItems[itemId].quantity - quantity;
        inventoryItems[itemId].lastUpdated = block.timestamp;

        // Mark new location as existing
        locationExists[toLocation] = true;

        _createTransaction(
            itemId,
            msg.sender,
            address(0),
            "TRANSFER",
            quantity,
            fromLocation,
            toLocation,
            reason
        );

        emit ItemTransferred(itemId, fromLocation, toLocation, quantity, msg.sender, block.timestamp);
    }

    /**
     * @dev Soft deletes an item (sets inactive)
     * @param itemId Item ID
     * @param reason Deletion reason
     */
    function deleteItem(
        uint256 itemId,
        string memory reason
    ) external onlyManagerOrAbove whenNotPaused itemExists(itemId) {
        inventoryItems[itemId].isActive = false;
        inventoryItems[itemId].lastUpdated = block.timestamp;

        _createTransaction(
            itemId,
            msg.sender,
            address(0),
            "DELETE",
            inventoryItems[itemId].quantity,
            "",
            "",
            reason
        );

        emit ItemDeleted(itemId, msg.sender, block.timestamp, reason);
    }

    /**
     * @dev Batch operation for creating multiple items
     */
    function batchCreateItems(
        string[] memory skus,
        string[] memory names,
        string[] memory descriptions,
        string[] memory categories,
        uint256[] memory quantities,
        string[] memory locations,
        string[] memory metadataHashes
    ) external onlyOperatorOrAbove whenNotPaused returns (uint256[] memory) {
        require(
            skus.length == names.length && 
            names.length == quantities.length && 
            quantities.length == locations.length,
            "InventoryManager: array length mismatch"
        );

        uint256[] memory itemIds = new uint256[](skus.length);

        for (uint256 i = 0; i < skus.length; i++) {
            itemIds[i] = createItem(
                skus[i],
                names[i],
                descriptions[i],
                categories[i],
                quantities[i],
                locations[i],
                metadataHashes[i]
            );
        }

        return itemIds;
    }

    /**
     * @dev Gets item details
     */
    function getItem(uint256 itemId) external view returns (InventoryItem memory) {
        require(itemId > 0 && itemId <= _itemIds.current(), "InventoryManager: item does not exist");
        return inventoryItems[itemId];
    }

    /**
     * @dev Gets all active items
     */
    function getAllActiveItems() external view returns (InventoryItem[] memory) {
        uint256 activeCount = 0;
        
        // Count active items
        for (uint256 i = 1; i <= _itemIds.current(); i++) {
            if (inventoryItems[i].isActive) {
                activeCount++;
            }
        }

        InventoryItem[] memory activeItems = new InventoryItem[](activeCount);
        uint256 currentIndex = 0;

        // Populate active items
        for (uint256 i = 1; i <= _itemIds.current(); i++) {
            if (inventoryItems[i].isActive) {
                activeItems[currentIndex] = inventoryItems[i];
                currentIndex++;
            }
        }

        return activeItems;
    }

    /**
     * @dev Gets transaction history for an item
     */
    function getItemTransactions(uint256 itemId) external view returns (Transaction[] memory) {
        require(itemId > 0 && itemId <= _itemIds.current(), "InventoryManager: item does not exist");
        return itemTransactions[itemId];
    }

    /**
     * @dev Gets total number of items
     */
    function getTotalItems() external view returns (uint256) {
        return _itemIds.current();
    }

    /**
     * @dev Gets items by location
     */
    function getItemsByLocation(string memory location) external view returns (InventoryItem[] memory) {
        uint256 locationCount = 0;
        
        // Count items at location
        for (uint256 i = 1; i <= _itemIds.current(); i++) {
            if (inventoryItems[i].isActive && 
                keccak256(bytes(inventoryItems[i].location)) == keccak256(bytes(location))) {
                locationCount++;
            }
        }

        InventoryItem[] memory locationItems = new InventoryItem[](locationCount);
        uint256 currentIndex = 0;

        // Populate location items
        for (uint256 i = 1; i <= _itemIds.current(); i++) {
            if (inventoryItems[i].isActive && 
                keccak256(bytes(inventoryItems[i].location)) == keccak256(bytes(location))) {
                locationItems[currentIndex] = inventoryItems[i];
                currentIndex++;
            }
        }

        return locationItems;
    }

    /**
     * @dev Pauses contract operations
     */
    function pause() external onlyAdmin {
        _pause();
    }

    /**
     * @dev Unpauses contract operations
     */
    function unpause() external onlyAdmin {
        _unpause();
    }

    /**
     * @dev Internal function to create transaction records
     */
    function _createTransaction(
        uint256 itemId,
        address executor,
        address toAddress,
        string memory action,
        uint256 quantity,
        string memory fromLocation,
        string memory toLocation,
        string memory reason
    ) internal {
        _transactionIds.increment();
        uint256 newTransactionId = _transactionIds.current();

        // Create transaction hash
        bytes32 transactionHash = keccak256(
            abi.encodePacked(
                newTransactionId,
                itemId,
                executor,
                action,
                quantity,
                block.timestamp
            )
        );

        Transaction memory newTransaction = Transaction({
            id: newTransactionId,
            itemId: itemId,
            fromAddress: executor,
            toAddress: toAddress,
            action: action,
            quantity: quantity,
            fromLocation: fromLocation,
            toLocation: toLocation,
            reason: reason,
            executor: executor,
            timestamp: block.timestamp,
            transactionHash: transactionHash
        });

        itemTransactions[itemId].push(newTransaction);
        userTransactions[executor].push(newTransactionId);

        emit TransactionLogged(newTransactionId, itemId, executor, action, block.timestamp);
    }
}