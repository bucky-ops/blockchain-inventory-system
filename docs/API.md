# API Documentation

## Overview

This document provides comprehensive API documentation for the Blockchain Inventory Management System. The API follows RESTful principles and uses JSON for data exchange.

## Base URL

- **Development**: `http://localhost:3001/api/v1`
- **Staging**: `https://staging-api.yourcompany.com/api/v1`
- **Production**: `https://api.yourcompany.com/api/v1`

## Authentication

The API uses JWT (JSON Web Token) authentication with blockchain-based user verification.

### Authentication Flow

1. **Get Nonce**: Request a unique nonce for signing
2. **Sign Message**: Sign the nonce with your wallet's private key
3. **Login**: Submit the signature to receive JWT tokens
4. **Authorize**: Include JWT token in subsequent requests

### Headers

```http
Authorization: Bearer <access_token>
Content-Type: application/json
X-Request-ID: <optional_request_id>
```

## Response Format

All API responses follow a consistent format:

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "timestamp": "2024-01-11T10:30:00.000Z",
  "requestId": "req_123456789"
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error description",
  "statusCode": 400,
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ],
  "timestamp": "2024-01-11T10:30:00.000Z",
  "requestId": "req_123456789"
}
```

## Rate Limiting

- **Standard**: 100 requests per 15 minutes per IP
- **Authenticated**: 500 requests per 15 minutes per user
- **Burst**: 10 requests per second

## Authentication Endpoints

### Get Nonce

Request a unique nonce for message signing.

```http
POST /auth/nonce
```

**Request Body**
```json
{
  "address": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4Db45"
}
```

**Response**
```json
{
  "success": true,
  "data": {
    "address": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4Db45",
    "nonce": "1699737600000",
    "expiresAt": "2024-01-11T11:00:00.000Z"
  }
}
```

### Login

Authenticate with signed message.

```http
POST /auth/login
```

**Request Body**
```json
{
  "address": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4Db45",
  "signature": "0x4a5c6...",
  "nonce": "1699737600000"
}
```

**Response**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "address": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4Db45",
      "email": "user@company.com",
      "fullName": "John Doe",
      "role": "OPERATOR"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 900,
      "tokenType": "Bearer"
    },
    "sessionId": "session_123456789"
  }
}
```

### Refresh Token

Refresh access token using refresh token.

```http
POST /auth/refresh
```

**Request Body**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Logout

Invalidate current session.

```http
POST /auth/logout
```

### Register User (Admin Only)

Register a new user in the system.

```http
POST /auth/register
```

**Request Body**
```json
{
  "address": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4Db45",
  "email": "newuser@company.com",
  "fullName": "New User",
  "role": "OPERATOR",
  "adminSignature": "0x4a5c6..."
}
```

## Inventory Endpoints

### Get All Items

Retrieve paginated list of inventory items.

```http
GET /inventory?page=1&limit=20&category=Electronics&location=Warehouse%20A
```

**Query Parameters**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `category`: Filter by category
- `location`: Filter by location
- `search`: Search in name, SKU, description
- `status`: Filter by status (active, inactive, low_stock)

**Response**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "sku": "ELEC-001",
        "name": "Laptop Computer",
        "description": "High-performance laptop",
        "category": "Electronics",
        "quantity": 50,
        "location": "Warehouse A",
        "creator": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4Db45",
        "createdAt": "2024-01-10T10:00:00.000Z",
        "lastUpdated": "2024-01-11T09:30:00.000Z",
        "isActive": true,
        "metadataHash": "QmXxx..."
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

### Get Item Details

Retrieve detailed information about a specific item.

```http
GET /inventory/{id}
```

**Response**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "sku": "ELEC-001",
    "name": "Laptop Computer",
    "description": "High-performance laptop",
    "category": "Electronics",
    "quantity": 50,
    "location": "Warehouse A",
    "creator": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4Db45",
    "createdAt": "2024-01-10T10:00:00.000Z",
    "lastUpdated": "2024-01-11T09:30:00.000Z",
    "isActive": true,
    "metadataHash": "QmXxx...",
    "blockchainHash": "0xabc123...",
    "transactionHistory": [
      {
        "id": 1,
        "action": "CREATE",
        "quantity": 100,
        "fromLocation": "",
        "toLocation": "Warehouse A",
        "reason": "Initial creation",
        "executor": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4Db45",
        "timestamp": "2024-01-10T10:00:00.000Z",
        "transactionHash": "0xabc123..."
      }
    ]
  }
}
```

### Create Item

Create a new inventory item.

```http
POST /inventory
```

**Request Body**
```json
{
  "sku": "ELEC-002",
  "name": "Gaming Mouse",
  "description": "Wireless gaming mouse",
  "category": "Electronics",
  "quantity": 25,
  "location": "Warehouse B",
  "metadataHash": "QmYyy..."
}
```

**Response**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "sku": "ELEC-002",
    "name": "Gaming Mouse",
    "description": "Wireless gaming mouse",
    "category": "Electronics",
    "quantity": 25,
    "location": "Warehouse B",
    "creator": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4Db45",
    "createdAt": "2024-01-11T10:00:00.000Z",
    "lastUpdated": "2024-01-11T10:00:00.000Z",
    "isActive": true,
    "metadataHash": "QmYyy...",
    "transactionHash": "0xdef456..."
  }
}
```

### Update Item Quantity

Update the quantity of an existing item.

```http
PUT /inventory/{id}
```

**Request Body**
```json
{
  "quantity": 75,
  "reason": "Stock replenishment"
}
```

### Transfer Item

Transfer items between locations.

```http
POST /inventory/{id}/transfer
```

**Request Body**
```json
{
  "toLocation": "Warehouse C",
  "quantity": 10,
  "reason": "Internal transfer"
}
```

### Delete Item

Soft delete an item (admin/manager only).

```http
DELETE /inventory/{id}
```

**Request Body**
```json
{
  "reason": "Item discontinued"
}
```

### Batch Create Items

Create multiple items in a single transaction.

```http
POST /inventory/batch
```

**Request Body**
```json
{
  "items": [
    {
      "sku": "BATCH-001",
      "name": "Batch Item 1",
      "description": "First batch item",
      "category": "Category A",
      "quantity": 10,
      "location": "Location 1",
      "metadataHash": "QmBatch1..."
    },
    {
      "sku": "BATCH-002",
      "name": "Batch Item 2",
      "description": "Second batch item",
      "category": "Category B",
      "quantity": 20,
      "location": "Location 2",
      "metadataHash": "QmBatch2..."
    }
  ]
}
```

## User Management Endpoints

### Get All Users

Retrieve list of all users (admin/manager only).

```http
GET /users?role=OPERATOR&status=Active
```

**Query Parameters**
- `role`: Filter by role
- `status`: Filter by status

### Get User Details

Retrieve details about a specific user.

```http
GET /users/{id}
```

### Update User Role

Update user role (admin only).

```http
PUT /users/{id}/role
```

**Request Body**
```json
{
  "role": "MANAGER",
  "reason": "Promotion to manager"
}
```

### Suspend User

Suspend a user account (admin only).

```http
PUT /users/{id}/suspend
```

**Request Body**
```json
{
  "reason": "Policy violation"
}
```

## Audit Endpoints

### Get Audit Logs

Retrieve audit log entries.

```http
GET /audit?eventType=INVENTORY_OPERATION&severity=HIGH&startDate=2024-01-01&endDate=2024-01-11
```

**Query Parameters**
- `eventType`: Filter by event type
- `severity`: Filter by severity level
- `startDate`: Start date (ISO format)
- `endDate`: End date (ISO format)
- `actor`: Filter by actor address
- `page`: Page number
- `limit`: Items per page

### Get User Activity

Retrieve activity for a specific user.

```http
GET /audit/users/{userId}
```

### Generate Compliance Report

Generate a compliance report (admin/auditor only).

```http
POST /audit/reports
```

**Request Body**
```json
{
  "reportType": "INVENTORY_SUMMARY",
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-01-11T23:59:59.999Z",
  "filters": {}
}
```

## System Endpoints

### Health Check

System health status.

```http
GET /health
```

**Response**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-11T10:30:00.000Z",
    "uptime": 86400,
    "version": "1.0.0",
    "environment": "production",
    "components": {
      "database": {
        "status": "up",
        "responseTime": 15,
        "lastCheck": "2024-01-11T10:30:00.000Z"
      },
      "blockchain": {
        "status": "up",
        "responseTime": 45,
        "lastCheck": "2024-01-11T10:30:00.000Z",
        "blockNumber": 1234567,
        "gasPrice": "20"
      },
      "redis": {
        "status": "up",
        "responseTime": 5,
        "lastCheck": "2024-01-11T10:30:00.000Z"
      }
    },
    "metrics": {
      "errorRate": 0.01,
      "averageResponseTime": 120,
      "activeUsers": 25,
      "pendingTransactions": 2
    }
  }
}
```

### System Metrics

Detailed system metrics.

```http
GET /admin/metrics
```

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input data |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Duplicate resource |
| 422 | Unprocessable Entity - Validation failed |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |
| 502 | Bad Gateway - Service unavailable |
| 503 | Service Unavailable - Maintenance mode |

## WebSocket API

Real-time updates for inventory changes.

### Connect

```javascript
const ws = new WebSocket('ws://localhost:3001/ws');

ws.onopen = () => {
  // Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your_jwt_token'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle real-time updates
};
```

### Message Types

- `inventory_update`: Inventory item updated
- `new_transaction`: New blockchain transaction
- `user_activity`: User activity update
- `system_alert`: System alert

## SDKs

### JavaScript/TypeScript

```bash
npm install @inventory-system/sdk
```

```typescript
import { InventoryAPI } from '@inventory-system/sdk';

const api = new InventoryAPI({
  baseURL: 'http://localhost:3001/api/v1',
  token: 'your_jwt_token'
});

const items = await api.inventory.getAll();
```

### Python

```bash
pip install inventory-system-sdk
```

```python
from inventory_system import InventoryAPI

api = InventoryAPI(
    base_url='http://localhost:3001/api/v1',
    token='your_jwt_token'
)

items = api.inventory.get_all()
```

## Testing

### Test Environment

For testing, use the sandbox environment:

- **Base URL**: `https://sandbox-api.yourcompany.com/api/v1`
- **Test Addresses**: Provided in developer dashboard

### Test Data

Use the following test credentials for development:

```json
{
  "address": "0x1234567890123456789012345678901234567890",
  "privateKey": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
}
```

## Support

- **Documentation**: https://docs.yourcompany.com
- **API Status**: https://status.yourcompany.com
- **Support Email**: api-support@yourcompany.com
- **Developer Chat**: https://discord.gg/yourcompany

## Changelog

### v1.0.0 (2024-01-11)
- Initial API release
- Authentication endpoints
- Inventory management
- User management
- Audit logging
- System monitoring