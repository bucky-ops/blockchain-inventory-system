// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./InventoryManager.sol";
import "./UserRegistry.sol";

/**
 * @title AuditLogger
 * @dev Comprehensive audit logging system for inventory operations
 * @notice Provides immutable audit trails for compliance and security
 */
contract AuditLogger is AccessControl, Pausable {
    using Counters for Counters.Counter;

    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");

    // Audit event types
    enum EventType {
        UserAction,
        InventoryOperation,
        SystemEvent,
        SecurityEvent,
        ConfigurationChange,
        DataAccess,
        Error,
        Compliance
    }

    // Severity levels
    enum Severity { Low, Medium, High, Critical }

    // Audit log structure
    struct AuditLog {
        uint256 id;
        bytes32 eventType;
        Severity severity;
        address actor;
        string action;
        string resource;
        string details;
        bytes32 dataHash;
        uint256 timestamp;
        uint256 blockNumber;
        bool isActive;
    }

    // Compliance report structure
    struct ComplianceReport {
        uint256 id;
        string reportType;
        uint256 startTime;
        uint256 endTime;
        bytes32 reportHash;
        address generatedBy;
        uint256 generatedAt;
        bool isActive;
    }

    // State variables
    Counters.Counter private _auditLogIds;
    Counters.Counter private _reportIds;
    
    // Reference contracts
    InventoryManager public immutable inventoryManager;
    UserRegistry public immutable userRegistry;

    // Mappings
    mapping(uint256 => AuditLog) public auditLogs;
    mapping(address => uint256[]) public userAuditLogs;
    mapping(bytes32 => uint256[]) public eventTypeLogs;
    mapping(Severity => uint256[]) public severityLogs;
    mapping(uint256 => ComplianceReport) public complianceReports;

    // Events
    event AuditLogged(
        uint256 indexed logId,
        bytes32 indexed eventType,
        address indexed actor,
        Severity severity,
        string action,
        uint256 timestamp
    );

    event ComplianceReportGenerated(
        uint256 indexed reportId,
        string indexed reportType,
        address indexed generator,
        uint256 timestamp
    );

    event SecurityAlert(
        uint256 indexed logId,
        address indexed actor,
        string alertType,
        uint256 timestamp
    );

    // Modifiers
    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "AuditLogger: caller is not admin");
        _;
    }

    modifier onlyAuditorOrAbove() {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || hasRole(AUDITOR_ROLE, msg.sender),
            "AuditLogger: caller is not auditor or admin"
        );
        _;
    }

    constructor(
        address defaultAdmin,
        address _inventoryManager,
        address _userRegistry
    ) {
        inventoryManager = InventoryManager(_inventoryManager);
        userRegistry = UserRegistry(_userRegistry);

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(ADMIN_ROLE, defaultAdmin);
        _grantRole(AUDITOR_ROLE, defaultAdmin);
        _setRoleAdmin(ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(AUDITOR_ROLE, ADMIN_ROLE);
    }

    /**
     * @dev Logs an audit event
     * @param eventType Type of event
     * @param severity Event severity
     * @param actor Address performing the action
     * @param action Action performed
     * @param resource Resource being acted upon
     * @param details Additional details
     * @param dataHash Hash of related data
     */
    function logAuditEvent(
        bytes32 eventType,
        Severity severity,
        address actor,
        string memory action,
        string memory resource,
        string memory details,
        bytes32 dataHash
    ) external whenNotPaused returns (uint256) {
        require(actor != address(0), "AuditLogger: invalid actor address");
        require(bytes(action).length > 0, "AuditLogger: action cannot be empty");

        _auditLogIds.increment();
        uint256 newLogId = _auditLogIds.current();

        auditLogs[newLogId] = AuditLog({
            id: newLogId,
            eventType: eventType,
            severity: severity,
            actor: actor,
            action: action,
            resource: resource,
            details: details,
            dataHash: dataHash,
            timestamp: block.timestamp,
            blockNumber: block.number,
            isActive: true
        });

        // Update mappings
        userAuditLogs[actor].push(newLogId);
        eventTypeLogs[eventType].push(newLogId);
        severityLogs[severity].push(newLogId);

        // Emit events
        emit AuditLogged(newLogId, eventType, actor, severity, action, block.timestamp);

        // Trigger security alert for critical events
        if (severity == Severity.Critical) {
            emit SecurityAlert(newLogId, actor, "CRITICAL_SECURITY_EVENT", block.timestamp);
        }

        return newLogId;
    }

    /**
     * @dev Generates a compliance report
     * @param reportType Type of compliance report
     * @param startTime Start time for report period
     * @param endTime End time for report period
     * @param filters Additional filters (JSON string)
     */
    function generateComplianceReport(
        string memory reportType,
        uint256 startTime,
        uint256 endTime,
        string memory filters
    ) external onlyAuditorOrAbove whenNotPaused returns (uint256) {
        require(bytes(reportType).length > 0, "AuditLogger: report type cannot be empty");
        require(startTime < endTime, "AuditLogger: invalid time range");
        require(endTime <= block.timestamp, "AuditLogger: end time cannot be in future");

        _reportIds.increment();
        uint256 newReportId = _reportIds.current();

        // Generate report hash (in production, this would contain the actual report data)
        bytes32 reportHash = keccak256(
            abi.encodePacked(
                reportType,
                startTime,
                endTime,
                filters,
                msg.sender,
                block.timestamp
            )
        );

        complianceReports[newReportId] = ComplianceReport({
            id: newReportId,
            reportType: reportType,
            startTime: startTime,
            endTime: endTime,
            reportHash: reportHash,
            generatedBy: msg.sender,
            generatedAt: block.timestamp,
            isActive: true
        });

        emit ComplianceReportGenerated(newReportId, reportType, msg.sender, block.timestamp);
        return newReportId;
    }

    /**
     * @dev Gets audit logs by user
     */
    function getUserAuditLogs(address user) external view returns (AuditLog[] memory) {
        uint256[] memory logIds = userAuditLogs[user];
        AuditLog[] memory logs = new AuditLog[](logIds.length);

        for (uint256 i = 0; i < logIds.length; i++) {
            logs[i] = auditLogs[logIds[i]];
        }

        return logs;
    }

    /**
     * @dev Gets audit logs by event type
     */
    function getAuditLogsByEventType(bytes32 eventType) external view returns (AuditLog[] memory) {
        uint256[] memory logIds = eventTypeLogs[eventType];
        AuditLog[] memory logs = new AuditLog[](logIds.length);

        for (uint256 i = 0; i < logIds.length; i++) {
            logs[i] = auditLogs[logIds[i]];
        }

        return logs;
    }

    /**
     * @dev Gets audit logs by severity
     */
    function getAuditLogsBySeverity(Severity severity) external view returns (AuditLog[] memory) {
        uint256[] memory logIds = severityLogs[severity];
        AuditLog[] memory logs = new AuditLog[](logIds.length);

        for (uint256 i = 0; i < logIds.length; i++) {
            logs[i] = auditLogs[logIds[i]];
        }

        return logs;
    }

    /**
     * @dev Gets audit logs within time range
     */
    function getAuditLogsByTimeRange(
        uint256 startTime,
        uint256 endTime
    ) external view returns (AuditLog[] memory) {
        require(startTime < endTime, "AuditLogger: invalid time range");

        uint256 totalCount = _auditLogIds.current();
        uint256 matchingCount = 0;

        // Count matching logs
        for (uint256 i = 1; i <= totalCount; i++) {
            if (auditLogs[i].timestamp >= startTime && auditLogs[i].timestamp <= endTime) {
                matchingCount++;
            }
        }

        AuditLog[] memory logs = new AuditLog[](matchingCount);
        uint256 currentIndex = 0;

        // Populate matching logs
        for (uint256 i = 1; i <= totalCount; i++) {
            if (auditLogs[i].timestamp >= startTime && auditLogs[i].timestamp <= endTime) {
                logs[currentIndex] = auditLogs[i];
                currentIndex++;
            }
        }

        return logs;
    }

    /**
     * @dev Gets recent audit logs
     */
    function getRecentAuditLogs(uint256 limit) external view returns (AuditLog[] memory) {
        uint256 totalCount = _auditLogIds.current();
        uint256 returnCount = limit > totalCount ? totalCount : limit;

        AuditLog[] memory logs = new AuditLog[](returnCount);
        uint256 currentIndex = 0;

        // Get most recent logs (reverse order)
        for (uint256 i = totalCount; i > totalCount - returnCount; i--) {
            logs[currentIndex] = auditLogs[i];
            currentIndex++;
        }

        return logs;
    }

    /**
     * @dev Gets compliance report
     */
    function getComplianceReport(uint256 reportId) external view returns (ComplianceReport memory) {
        require(reportId > 0 && reportId <= _reportIds.current(), "AuditLogger: report does not exist");
        return complianceReports[reportId];
    }

    /**
     * @dev Gets all compliance reports
     */
    function getAllComplianceReports() external view returns (ComplianceReport[] memory) {
        uint256 totalReports = _reportIds.current();
        ComplianceReport[] memory reports = new ComplianceReport[](totalReports);

        for (uint256 i = 1; i <= totalReports; i++) {
            reports[i - 1] = complianceReports[i];
        }

        return reports;
    }

    /**
     * @dev Gets audit statistics
     */
    function getAuditStatistics() external view returns (
        uint256 totalLogs,
        uint256 criticalLogs,
        uint256 highLogs,
        uint256 mediumLogs,
        uint256 lowLogs
    ) {
        totalLogs = _auditLogIds.current();
        criticalLogs = severityLogs[Severity.Critical].length;
        highLogs = severityLogs[Severity.High].length;
        mediumLogs = severityLogs[Severity.Medium].length;
        lowLogs = severityLogs[Severity.Low].length;
    }

    /**
     * @dev Archives an audit log (soft delete)
     */
    function archiveAuditLog(uint256 logId) external onlyAdmin whenNotPaused {
        require(logId > 0 && logId <= _auditLogIds.current(), "AuditLogger: log does not exist");
        require(auditLogs[logId].isActive, "AuditLogger: log already archived");

        auditLogs[logId].isActive = false;

        // Log the archiving action
        this.logAuditEvent(
            keccak256("SystemEvent"),
            Severity.Low,
            msg.sender,
            "ARCHIVE_AUDIT_LOG",
            string(abi.encodePacked("Log ID: ", logId)),
            "Audit log archived by admin",
            keccak256(abi.encodePacked(logId, block.timestamp))
        );
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
     * @dev Gets total number of audit logs
     */
    function getTotalAuditLogs() external view returns (uint256) {
        return _auditLogIds.current();
    }

    /**
     * @dev Gets total number of compliance reports
     */
    function getTotalComplianceReports() external view returns (uint256) {
        return _reportIds.current();
    }

    // Helper functions for event type constants
    function USER_ACTION() public pure returns (bytes32) {
        return keccak256("UserAction");
    }

    function INVENTORY_OPERATION() public pure returns (bytes32) {
        return keccak256("InventoryOperation");
    }

    function SYSTEM_EVENT() public pure returns (bytes32) {
        return keccak256("SystemEvent");
    }

    function SECURITY_EVENT() public pure returns (bytes32) {
        return keccak256("SecurityEvent");
    }

    function CONFIGURATION_CHANGE() public pure returns (bytes32) {
        return keccak256("ConfigurationChange");
    }

    function DATA_ACCESS() public pure returns (bytes32) {
        return keccak256("DataAccess");
    }

    function ERROR() public pure returns (bytes32) {
        return keccak256("Error");
    }

    function COMPLIANCE() public pure returns (bytes32) {
        return keccak256("Compliance");
    }
}