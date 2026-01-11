// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title UserRegistry
 * @dev Manages user registration, authentication, and role-based access control
 * @notice Provides secure user management with audit trails
 */
contract UserRegistry is AccessControl, Pausable {
    using Counters for Counters.Counter;

    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
    bytes32 public constant VIEWER_ROLE = keccak256("VIEWER_ROLE");

    // User status enum
    enum UserStatus { Active, Inactive, Suspended }

    // User structure
    struct User {
        uint256 id;
        address walletAddress;
        string email;
        string fullName;
        bytes32 role;
        UserStatus status;
        uint256 createdAt;
        uint256 lastLogin;
        bool exists;
    }

    // Login session structure
    struct LoginSession {
        address userAddress;
        uint256 loginTime;
        uint256 expiryTime;
        string userAgent;
        string ipAddress;
        bool isActive;
    }

    // State variables
    Counters.Counter private _userIds;
    Counters.Counter private _sessionIds;
    
    // Mappings
    mapping(address => User) public users;
    mapping(string => address) public emailToAddress;
    mapping(uint256 => LoginSession) public sessions;
    mapping(address => uint256[]) public userSessions;
    mapping(bytes32 => address[]) public roleUsers;

    // Events
    event UserRegistered(
        uint256 indexed userId,
        address indexed walletAddress,
        string indexed email,
        bytes32 role,
        address registeredBy,
        uint256 timestamp
    );

    event UserUpdated(
        uint256 indexed userId,
        address indexed walletAddress,
        bytes32 oldRole,
        bytes32 newRole,
        address updatedBy,
        uint256 timestamp
    );

    event UserSuspended(
        uint256 indexed userId,
        address indexed walletAddress,
        string reason,
        address suspendedBy,
        uint256 timestamp
    );

    event UserReactivated(
        uint256 indexed userId,
        address indexed walletAddress,
        address reactivatedBy,
        uint256 timestamp
    );

    event LoginAttempt(
        address indexed walletAddress,
        bool success,
        string ipAddress,
        string userAgent,
        uint256 timestamp
    );

    event LoginSessionCreated(
        uint256 indexed sessionId,
        address indexed userAddress,
        uint256 expiryTime,
        uint256 timestamp
    );

    event LoginSessionExpired(
        uint256 indexed sessionId,
        address indexed userAddress,
        uint256 timestamp
    );

    // Modifiers
    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "UserRegistry: caller is not admin");
        _;
    }

    modifier onlyManagerOrAbove() {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || hasRole(MANAGER_ROLE, msg.sender),
            "UserRegistry: caller is not manager or admin"
        );
        _;
    }

    modifier userExists(address walletAddress) {
        require(users[walletAddress].exists, "UserRegistry: user does not exist");
        _;
    }

    modifier emailNotExists(string memory email) {
        require(emailToAddress[email] == address(0), "UserRegistry: email already exists");
        _;
    }

    modifier validEmail(string memory email) {
        require(bytes(email).length > 0, "UserRegistry: email cannot be empty");
        require(bytes(email).length <= 255, "UserRegistry: email too long");
        _;
    }

    constructor(address defaultAdmin) {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(ADMIN_ROLE, defaultAdmin);
        _setRoleAdmin(ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(MANAGER_ROLE, ADMIN_ROLE);
        _setRoleAdmin(AUDITOR_ROLE, MANAGER_ROLE);
        _setRoleAdmin(VIEWER_ROLE, AUDITOR_ROLE);

        // Register the initial admin
        _registerUser(
            defaultAdmin,
            "admin@company.com",
            "System Administrator",
            ADMIN_ROLE,
            "Initial admin registration"
        );
    }

    /**
     * @dev Registers a new user (admin only)
     * @param walletAddress User's wallet address
     * @param email User's email
     * @param fullName User's full name
     * @param role User's role
     * @param reason Registration reason
     */
    function registerUser(
        address walletAddress,
        string memory email,
        string memory fullName,
        bytes32 role,
        string memory reason
    ) external onlyAdmin whenNotPaused emailNotExists(email) validEmail(email) returns (uint256) {
        require(walletAddress != address(0), "UserRegistry: invalid wallet address");
        require(bytes(fullName).length > 0, "UserRegistry: full name cannot be empty");
        require(
            role == ADMIN_ROLE || role == MANAGER_ROLE || role == AUDITOR_ROLE || role == VIEWER_ROLE,
            "UserRegistry: invalid role"
        );

        return _registerUser(walletAddress, email, fullName, role, reason);
    }

    /**
     * @dev Updates user role
     * @param walletAddress User's wallet address
     * @param newRole New role
     * @param reason Update reason
     */
    function updateUserRole(
        address walletAddress,
        bytes32 newRole,
        string memory reason
    ) external onlyAdmin whenNotPaused userExists(walletAddress) {
        require(
            newRole == ADMIN_ROLE || newRole == MANAGER_ROLE || newRole == AUDITOR_ROLE || newRole == VIEWER_ROLE,
            "UserRegistry: invalid role"
        );

        bytes32 oldRole = users[walletAddress].role;
        require(oldRole != newRole, "UserRegistry: role unchanged");

        // Remove from old role mapping
        _removeFromRoleMapping(walletAddress, oldRole);
        
        // Update user
        users[walletAddress].role = newRole;
        
        // Add to new role mapping
        roleUsers[newRole].push(walletAddress);

        emit UserUpdated(
            users[walletAddress].id,
            walletAddress,
            oldRole,
            newRole,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @dev Suspends a user
     * @param walletAddress User's wallet address
     * @param reason Suspension reason
     */
    function suspendUser(
        address walletAddress,
        string memory reason
    ) external onlyAdmin whenNotPaused userExists(walletAddress) {
        require(
            users[walletAddress].status == UserStatus.Active,
            "UserRegistry: user already suspended"
        );
        require(
            walletAddress != msg.sender,
            "UserRegistry: cannot suspend yourself"
        );

        users[walletAddress].status = UserStatus.Suspended;
        _expireAllUserSessions(walletAddress);

        emit UserSuspended(
            users[walletAddress].id,
            walletAddress,
            reason,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @dev Reactivates a suspended user
     * @param walletAddress User's wallet address
     * @param reason Reactivation reason
     */
    function reactivateUser(
        address walletAddress,
        string memory reason
    ) external onlyAdmin whenNotPaused userExists(walletAddress) {
        require(
            users[walletAddress].status == UserStatus.Suspended,
            "UserRegistry: user not suspended"
        );

        users[walletAddress].status = UserStatus.Active;

        emit UserReactivated(
            users[walletAddress].id,
            walletAddress,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @dev Records login attempt
     * @param walletAddress User's wallet address
     * @param success Whether login was successful
     * @param ipAddress User's IP address
     * @param userAgent User's user agent
     */
    function recordLoginAttempt(
        address walletAddress,
        bool success,
        string memory ipAddress,
        string memory userAgent
    ) external whenNotPaused {
        if (success && users[walletAddress].exists && users[walletAddress].status == UserStatus.Active) {
            users[walletAddress].lastLogin = block.timestamp;
        }

        emit LoginAttempt(walletAddress, success, ipAddress, userAgent, block.timestamp);
    }

    /**
     * @dev Creates a new login session
     * @param walletAddress User's wallet address
     * @param expiryTime Session expiry time
     * @param userAgent User agent
     * @param ipAddress IP address
     */
    function createLoginSession(
        address walletAddress,
        uint256 expiryTime,
        string memory userAgent,
        string memory ipAddress
    ) external whenNotPaused userExists(walletAddress) returns (uint256) {
        require(
            users[walletAddress].status == UserStatus.Active,
            "UserRegistry: user not active"
        );
        require(expiryTime > block.timestamp, "UserRegistry: invalid expiry time");

        _sessionIds.increment();
        uint256 newSessionId = _sessionIds.current();

        sessions[newSessionId] = LoginSession({
            userAddress: walletAddress,
            loginTime: block.timestamp,
            expiryTime: expiryTime,
            userAgent: userAgent,
            ipAddress: ipAddress,
            isActive: true
        });

        userSessions[walletAddress].push(newSessionId);

        emit LoginSessionCreated(newSessionId, walletAddress, expiryTime, block.timestamp);
        return newSessionId;
    }

    /**
     * @dev Expires a login session
     * @param sessionId Session ID
     */
    function expireLoginSession(uint256 sessionId) external whenNotPaused {
        require(sessions[sessionId].isActive, "UserRegistry: session not active");
        require(sessions[sessionId].expiryTime <= block.timestamp, "UserRegistry: session not expired");

        address userAddress = sessions[sessionId].userAddress;
        sessions[sessionId].isActive = false;

        emit LoginSessionExpired(sessionId, userAddress, block.timestamp);
    }

    /**
     * @dev Gets user information
     */
    function getUser(address walletAddress) external view returns (User memory) {
        return users[walletAddress];
    }

    /**
     * @dev Gets user by email
     */
    function getUserByEmail(string memory email) external view returns (User memory) {
        address walletAddress = emailToAddress[email];
        return users[walletAddress];
    }

    /**
     * @dev Checks if user has specific role
     */
    function hasRole(bytes32 role, address account) public view override returns (bool) {
        return super.hasRole(role, account) || (users[account].exists && users[account].role == role);
    }

    /**
     * @dev Gets all users with specific role
     */
    function getUsersByRole(bytes32 role) external view returns (address[] memory) {
        return roleUsers[role];
    }

    /**
     * @dev Gets active user sessions
     */
    function getUserActiveSessions(address walletAddress) external view returns (uint256[] memory) {
        uint256[] memory allSessions = userSessions[walletAddress];
        uint256 activeCount = 0;

        // Count active sessions
        for (uint256 i = 0; i < allSessions.length; i++) {
            if (sessions[allSessions[i]].isActive && sessions[allSessions[i]].expiryTime > block.timestamp) {
                activeCount++;
            }
        }

        uint256[] memory activeSessions = new uint256[](activeCount);
        uint256 currentIndex = 0;

        // Populate active sessions
        for (uint256 i = 0; i < allSessions.length; i++) {
            if (sessions[allSessions[i]].isActive && sessions[allSessions[i]].expiryTime > block.timestamp) {
                activeSessions[currentIndex] = allSessions[i];
                currentIndex++;
            }
        }

        return activeSessions;
    }

    /**
     * @dev Gets total number of users
     */
    function getTotalUsers() external view returns (uint256) {
        return _userIds.current();
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
     * @dev Internal function to register a user
     */
    function _registerUser(
        address walletAddress,
        string memory email,
        string memory fullName,
        bytes32 role,
        string memory reason
    ) internal returns (uint256) {
        _userIds.increment();
        uint256 newUserId = _userIds.current();

        users[walletAddress] = User({
            id: newUserId,
            walletAddress: walletAddress,
            email: email,
            fullName: fullName,
            role: role,
            status: UserStatus.Active,
            createdAt: block.timestamp,
            lastLogin: 0,
            exists: true
        });

        emailToAddress[email] = walletAddress;
        roleUsers[role].push(walletAddress);

        emit UserRegistered(newUserId, walletAddress, email, role, msg.sender, block.timestamp);
        return newUserId;
    }

    /**
     * @dev Removes user from role mapping
     */
    function _removeFromRoleMapping(address walletAddress, bytes32 role) internal {
        address[] storage roleUserList = roleUsers[role];
        for (uint256 i = 0; i < roleUserList.length; i++) {
            if (roleUserList[i] == walletAddress) {
                // Move last element to current position and pop
                roleUserList[i] = roleUserList[roleUserList.length - 1];
                roleUserList.pop();
                break;
            }
        }
    }

    /**
     * @dev Expires all user sessions
     */
    function _expireAllUserSessions(address walletAddress) internal {
        uint256[] memory userSessionList = userSessions[walletAddress];
        for (uint256 i = 0; i < userSessionList.length; i++) {
            if (sessions[userSessionList[i]].isActive) {
                sessions[userSessionList[i]].isActive = false;
                emit LoginSessionExpired(userSessionList[i], walletAddress, block.timestamp);
            }
        }
    }
}