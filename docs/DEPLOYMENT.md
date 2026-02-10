# Deployment Guide

This guide covers deployment of the Blockchain Inventory Management System across different environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Local Development](#local-development)
4. [Staging Deployment](#staging-deployment)
5. [Production Deployment](#production-deployment)
6. [Docker Deployment](#docker-deployment)
7. [Kubernetes Deployment](#kubernetes-deployment)
8. [Monitoring and Maintenance](#monitoring-and-maintenance)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **PostgreSQL** >= 14.0
- **Redis** >= 6.0
- **Docker** >= 20.10
- **Docker Compose** >= 2.0

### System Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 4GB
- Storage: 20GB
- Network: 100 Mbps

**Recommended:**
- CPU: 4 cores
- RAM: 8GB
- Storage: 50GB SSD
- Network: 1 Gbps

### Blockchain Requirements

- **Ethereum node** (geth/infura/alchemy)
- **Testnet ETH** for contract deployment
- **Mainnet ETH** for production

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/blockchain-inventory-system.git
cd blockchain-inventory-system
```

### 2. Environment Variables

Copy the environment template:

```bash
cp .env.example .env
```

Configure critical variables:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=inventory_db
DB_USER=inventory_user
DB_PASSWORD=your_secure_password

# Blockchain
BLOCKCHAIN_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
PRIVATE_KEY=0xyour_private_key_here

# Security
JWT_SECRET=your_jwt_secret_minimum_32_characters
ENCRYPTION_KEY=your_32_character_encryption_key
```

### 3. Install Dependencies

```bash
npm run install:all
```

## Local Development

### 1. Database Setup

```bash
# Create database
createdb inventory_db

# Run migrations
npm run migrate
```

### 2. Blockchain Setup

```bash
cd blockchain
npm run compile
npm run node  # Start local hardhat node
```

In another terminal:

```bash
cd blockchain
npm run deploy  # Deploy contracts to local node
```

### 3. Start Services

```bash
# Start all services
npm run dev

# Or start individually
npm run dev:backend    # http://localhost:3001
npm run dev:frontend   # http://localhost:3000
npm run dev:ai-agents  # AI agents
```

### 4. Verify Setup

Visit http://localhost:3000 and connect with MetaMask to localhost:8545.

## Staging Deployment

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Application Deployment

```bash
# Clone repository
git clone https://github.com/your-org/blockchain-inventory-system.git
cd blockchain-inventory-system

# Configure environment
cp .env.example .env.staging
# Edit .env.staging with staging values

# Deploy with Docker Compose
docker-compose -f docker-compose.staging.yml up -d
```

### 3. SSL Certificate

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d staging.yourcompany.com
```

## Production Deployment

### 1. Infrastructure Setup

#### Database Setup

```bash
# PostgreSQL setup
sudo apt install postgresql postgresql-contrib
sudo -u postgres createdb inventory_prod

# Redis setup
sudo apt install redis-server
sudo systemctl enable redis
```

#### Nginx Setup

```bash
sudo apt install nginx
sudo cp config/nginx/nginx.prod.conf /etc/nginx/sites-available/inventory
sudo ln -s /etc/nginx/sites-available/inventory /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 2. Application Deployment

```bash
# Create application user
sudo useradd -m -s /bin/bash inventory
sudo usermod -aG docker inventory

# Deploy application
sudo -u inventory git clone https://github.com/your-org/blockchain-inventory-system.git /opt/inventory-system
cd /opt/inventory-system

# Configure production environment
cp .env.example .env.production
# Edit with production values

# Build and start services
docker-compose -f docker-compose.prod.yml up -d
```

### 3. Security Hardening

```bash
# Firewall setup
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443

# Fail2ban setup
sudo apt install fail2ban
sudo systemctl enable fail2ban

# Log monitoring
sudo apt install logrotate
sudo cp config/logrotate/inventory /etc/logrotate.d/
```

## Docker Deployment

### 1. Build Images

```bash
# Backend
docker build -t inventory-backend ./backend

# Frontend
docker build -t inventory-frontend ./frontend

# AI Agents
docker build -t inventory-ai-agents ./ai-agents
```

### 2. Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    image: inventory-backend:latest
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
    depends_on:
      - database
      - redis
    volumes:
      - ./logs:/app/logs

  frontend:
    image: inventory-frontend:latest
    ports:
      - "3000:80"
    depends_on:
      - backend

  database:
    image: postgres:14
    environment:
      - POSTGRES_DB=inventory_db
      - POSTGRES_USER=inventory_user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}

  ai-agents:
    image: inventory-ai-agents:latest
    environment:
      - NODE_ENV=production
    depends_on:
      - database
      - redis

volumes:
  postgres_data:
```

### 3. Run Services

```bash
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Kubernetes Deployment

### 1. Cluster Setup

```bash
# Create namespace
kubectl create namespace inventory

# Apply configurations
kubectl apply -f k8s/
```

### 2. ConfigMaps and Secrets

```bash
# Create configmap
kubectl create configmap inventory-config \
  --from-env-file=.env.production \
  --namespace=inventory

# Create secrets
kubectl create secret generic inventory-secrets \
  --from-literal=db-password=${DB_PASSWORD} \
  --from-literal=jwt-secret=${JWT_SECRET} \
  --namespace=inventory
```

### 3. Deploy Services

```bash
# Deploy database
kubectl apply -f k8s/database/

# Deploy application
kubectl apply -f k8s/backend/
kubectl apply -f k8s/frontend/
kubectl apply -f k8s/ai-agents/

# Deploy ingress
kubectl apply -f k8s/ingress/
```

### 4. Monitor Deployment

```bash
# Check pod status
kubectl get pods -n inventory

# View logs
kubectl logs -f deployment/backend -n inventory

# Check services
kubectl get services -n inventory
```

## Monitoring and Maintenance

### 1. Health Checks

```bash
# API health check
curl https://api.yourcompany.com/health

# Database health
psql -h localhost -U inventory_user -d inventory_prod -c "SELECT 1;"

# Redis health
redis-cli ping
```

### 2. Logs Monitoring

```bash
# Application logs
docker-compose logs -f backend

# System logs
sudo journalctl -u inventory-backend -f

# Nginx logs
sudo tail -f /var/log/nginx/access.log
```

### 3. Backup Strategy

```bash
# Database backup
pg_dump -h localhost -U inventory_user inventory_prod > backup_$(date +%Y%m%d_%H%M%S).sql

# Blockchain data backup
# Backup wallet files and contract ABIs

# Configuration backup
tar -czf config_backup_$(date +%Y%m%d_%H%M%S).tar.gz .env* docker-compose*.yml
```

### 4. Updates and Maintenance

```bash
# Update application
git pull origin main
docker-compose pull
docker-compose up -d

# Database migrations
npm run migrate:prod

# Restart services
docker-compose restart
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors

```bash
# Check database status
sudo systemctl status postgresql

# Check connection
psql -h localhost -U inventory_user -d inventory_db

# Verify environment variables
echo $DB_HOST $DB_PORT $DB_NAME
```

#### 2. Blockchain Connection Issues

```bash
# Check node status
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  $BLOCKCHAIN_RPC_URL

# Verify contract addresses
echo $CONTRACT_ADDRESS_INVENTORY_MANAGER
```

#### 3. Memory Issues

```bash
# Check memory usage
free -h
docker stats

# Restart services
docker-compose restart

# Clear cache
docker system prune -a
```

#### 4. SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Renew certificate
sudo certbot renew

# Test SSL configuration
sudo nginx -t
```

### Performance Optimization

#### 1. Database Optimization

```sql
-- Create indexes
CREATE INDEX idx_inventory_sku ON inventory(sku);
CREATE INDEX idx_inventory_category ON inventory(category);
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM inventory WHERE category = 'Electronics';
```

#### 2. Caching Strategy

```bash
# Redis optimization
redis-cli CONFIG SET maxmemory 2gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

#### 3. Load Balancing

```nginx
upstream backend {
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}
```

### Security Checklist

- [ ] Change default passwords
- [ ] Enable SSL/TLS
- [ ] Configure firewall
- [ ] Set up intrusion detection
- [ ] Regular security updates
- [ ] Backup encryption
- [ ] Access control review
- [ ] Audit logging enabled

## Support

For deployment assistance:

- **Documentation**: https://docs.yourcompany.com
- **Support**: support@yourcompany.com
- **Emergency**: emergency@yourcompany.com
- **Status Page**: https://status.yourcompany.com