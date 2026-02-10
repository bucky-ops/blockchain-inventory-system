# 🚀 Quick Start Guide

This guide will help you get the Blockchain Inventory System running in minutes.

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Git

## One-Command Deployment

```bash
# Clone and deploy everything
git clone <repository-url>
cd blockchain-inventory-system
npm run deploy:local
```

That's it! 🎉 The script will:

- Set up infrastructure (PostgreSQL, Redis)
- Deploy smart contracts to local blockchain
- Initialize database with sample data
- Start all services (backend, frontend, AI agents)
- Configure monitoring tools

## Manual Setup (if needed)

1. **Install Dependencies**

   ```bash
   npm run install:all
   ```

2. **Start Infrastructure**

   ```bash
   npm run deploy:infra
   ```

3. **Setup Database**

   ```bash
   npm run setup:db
   ```

4. **Deploy Contracts**

   ```bash
   npm run blockchain:deploy
   ```

5. **Start Services**
   ```bash
   npm run dev
   ```

## Access Points

| Service        | URL                            | Description           |
| -------------- | ------------------------------ | --------------------- |
| 🌐 Frontend    | http://localhost:3000          | Main application      |
| 🔧 Backend API | http://localhost:3001          | REST API              |
| 📊 API Docs    | http://localhost:3001/api/docs | Swagger documentation |
| 📈 Grafana     | http://localhost:3002          | Monitoring dashboard  |
| 🔍 Kibana      | http://localhost:5601          | Log analysis          |
| 📊 Prometheus  | http://localhost:9090          | Metrics collection    |

## Default Credentials

**Admin User:**

- Wallet Address: `0x1234567890123456789012345678901234567890`
- Username: `admin`
- Role: `admin`

**Database:**

- Host: `localhost:5432`
- Database: `blockchain_inventory_dev`
- Username: `postgres`
- Password: `password`

## Common Commands

```bash
# View all services status
npm run status

# View logs
npm run logs

# Stop all services
npm run stop:all

# Reset database
npm run reset:db

# Run tests
npm run test

# Security audit
npm run security:audit
```

## Troubleshooting

### Port Conflicts

If ports are already in use, modify them in `.env` file:

```bash
# Change ports if needed
FRONTEND_PORT=3000
BACKEND_PORT=3001
```

### Database Issues

```bash
# Reset database completely
docker-compose -f docker-compose.dev.yml down postgres
docker volume rm blockchain-inventory-system_postgres_data
npm run deploy:infra
npm run setup:db
```

### Blockchain Connection

```bash
# Restart local blockchain
npm run blockchain:node
# In another terminal, deploy contracts
npm run blockchain:deploy
```

## Development Workflow

1. Make changes to code
2. Services auto-restart (hot reload enabled)
3. View logs: `npm run logs`
4. Run tests: `npm run test`
5. Check health: `npm run health`

## Production Deployment

For production deployment:

1. Update `.env` with production values
2. Use `docker-compose.prod.yml`
3. Set up SSL certificates
4. Configure proper monitoring
5. Set up backup strategies

## Need Help?

- 📖 Check [full documentation](./docs/)
- 🐛 [Report issues](https://github.com/your-repo/issues)
- 💬 Join our [Discord community](https://discord.gg/your-server)
- 📧 Email: support@blockchain-inventory.com

---

**Happy coding! 🚀**
