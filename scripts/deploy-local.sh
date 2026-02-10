#!/bin/bash

# Blockchain Inventory System - Local Deployment Script
# This script sets up and deploys the entire system locally

set -e

echo "🚀 Starting Blockchain Inventory System Local Deployment..."
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if required tools are installed
check_requirements() {
    print_step "Checking requirements..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose"
        exit 1
    fi
    
    # Check PostgreSQL
    if ! command -v psql &> /dev/null; then
        print_warning "PostgreSQL client not found. Make sure PostgreSQL is installed"
    fi
    
    # Check Redis
    if ! command -v redis-cli &> /dev/null; then
        print_warning "Redis client not found. Make sure Redis is installed"
    fi
    
    print_status "All requirements checked ✓"
}

# Setup environment variables
setup_environment() {
    print_step "Setting up environment variables..."
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        print_status "Creating .env file from template..."
        cp .env.example .env
    fi
    
    # Generate random secrets
    JWT_SECRET=$(openssl rand -hex 32)
    JWT_REFRESH_SECRET=$(openssl rand -hex 32)
    SESSION_SECRET=$(openssl rand -hex 32)
    
    # Update .env file with generated secrets
    sed -i "s/your-super-secret-jwt-key-here/$JWT_SECRET/g" .env
    sed -i "s/your-super-secret-refresh-key-here/$JWT_REFRESH_SECRET/g" .env
    sed -i "s/your-super-secret-session-key-here/$SESSION_SECRET/g" .env
    
    print_status "Environment variables configured ✓"
}

# Start infrastructure services
start_infrastructure() {
    print_step "Starting infrastructure services..."
    
    # Start PostgreSQL and Redis using Docker Compose
    docker-compose -f docker-compose.dev.yml up -d postgres redis
    
    # Wait for services to be ready
    print_status "Waiting for PostgreSQL to be ready..."
    sleep 10
    
    print_status "Waiting for Redis to be ready..."
    sleep 5
    
    print_status "Infrastructure services started ✓"
}

# Setup database
setup_database() {
    print_step "Setting up database..."
    
    # Install dependencies
    npm install
    
    # Run database migrations
    cd database
    npm install
    
    print_status "Running database migrations..."
    npx knex migrate:latest --env development
    
    print_status "Running database seeds..."
    npx knex seed:run --env development
    
    cd ..
    
    print_status "Database setup completed ✓"
}

# Deploy smart contracts
deploy_contracts() {
    print_step "Deploying smart contracts..."
    
    # Install blockchain dependencies
    cd blockchain
    npm install
    
    # Start local Hardhat network
    print_status "Starting local blockchain network..."
    npx hardhat node &
    HARDHAT_PID=$!
    sleep 5
    
    # Deploy contracts
    print_status "Deploying contracts to local network..."
    npx hardhat run scripts/deploy.js --network localhost
    
    # Stop Hardhat node
    kill $HARDHAT_PID 2>/dev/null || true
    
    cd ..
    
    print_status "Smart contracts deployed ✓"
}

# Update configuration with deployed addresses
update_configuration() {
    print_step "Updating configuration with deployed addresses..."
    
    # Read deployment info
    if [ -f blockchain/deployment-info.json ]; then
        # Extract contract addresses
        USER_REGISTRY_ADDRESS=$(cat blockchain/deployment-info.json | jq -r '.contracts.UserRegistry')
        INVENTORY_MANAGER_ADDRESS=$(cat blockchain/deployment-info.json | jq -r '.contracts.InventoryManager')
        AUDIT_LOGGER_ADDRESS=$(cat blockchain/deployment-info.json | jq -r '.contracts.AuditLogger')
        
        # Update .env file
        sed -i "s/CONTRACT_ADDRESS_USER_REGISTRY=.*/CONTRACT_ADDRESS_USER_REGISTRY=$USER_REGISTRY_ADDRESS/g" .env
        sed -i "s/CONTRACT_ADDRESS_INVENTORY_MANAGER=.*/CONTRACT_ADDRESS_INVENTORY_MANAGER=$INVENTORY_MANAGER_ADDRESS/g" .env
        sed -i "s/CONTRACT_ADDRESS_AUDIT_LOGGER=.*/CONTRACT_ADDRESS_AUDIT_LOGGER=$AUDIT_LOGGER_ADDRESS/g" .env
        
        print_status "Configuration updated with contract addresses ✓"
    else
        print_warning "Deployment info not found. Please update contract addresses manually."
    fi
}

# Start backend services
start_backend() {
    print_step "Starting backend services..."
    
    cd backend
    npm install
    npm run build
    
    # Start backend in background
    npm run dev &
    BACKEND_PID=$!
    
    cd ..
    
    # Wait for backend to start
    sleep 10
    
    print_status "Backend services started ✓"
}

# Start frontend
start_frontend() {
    print_step "Starting frontend..."
    
    cd frontend
    npm install
    npm run build
    
    # Start frontend in background
    npm run dev &
    FRONTEND_PID=$!
    
    cd ..
    
    # Wait for frontend to start
    sleep 10
    
    print_status "Frontend started ✓"
}

# Start AI agents
start_ai_agents() {
    print_step "Starting AI agents..."
    
    cd ai-agents
    npm install
    npm run build
    
    # Start AI agents in background
    npm run dev &
    AI_AGENTS_PID=$!
    
    cd ..
    
    # Wait for AI agents to start
    sleep 5
    
    print_status "AI agents started ✓"
}

# Run health checks
run_health_checks() {
    print_step "Running health checks..."
    
    # Check backend health
    if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
        print_status "Backend health check passed ✓"
    else
        print_error "Backend health check failed"
    fi
    
    # Check frontend
    if curl -f http://localhost:3000 > /dev/null 2>&1; then
        print_status "Frontend health check passed ✓"
    else
        print_error "Frontend health check failed"
    fi
    
    # Check database connection
    if cd database && npx knex migrate:status --env development > /dev/null 2>&1; then
        print_status "Database health check passed ✓"
    else
        print_error "Database health check failed"
    fi
    cd ..
    
    # Check Redis connection
    if redis-cli ping > /dev/null 2>&1; then
        print_status "Redis health check passed ✓"
    else
        print_error "Redis health check failed"
    fi
}

# Display deployment summary
display_summary() {
    echo ""
    echo "=================================================="
    echo -e "${GREEN}🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!${NC}"
    echo "=================================================="
    echo ""
    echo "📱 Application URLs:"
    echo "   Frontend:           http://localhost:3000"
    echo "   Backend API:        http://localhost:3001"
    echo "   API Documentation:   http://localhost:3001/api/docs"
    echo ""
    echo "🔧 Development Tools:"
    echo "   PostgreSQL:         localhost:5432"
    echo "   Redis:              localhost:6379"
    echo "   Blockchain:         http://localhost:8545 (Hardhat)"
    echo ""
    echo "👤 Default Admin User:"
    echo "   Address:            0x1234567890123456789012345678901234567890"
    echo "   Username:           admin"
    echo "   Role:               admin"
    echo ""
    echo "📊 System Status:"
    echo "   Frontend:           Running (PID: $FRONTEND_PID)"
    echo "   Backend:            Running (PID: $BACKEND_PID)"
    echo "   AI Agents:          Running (PID: $AI_AGENTS_PID)"
    echo "   Database:           PostgreSQL + Redis"
    echo "   Blockchain:         Local Hardhat Network"
    echo ""
    echo "🛠️ Management Commands:"
    echo "   Stop all services:  ./scripts/stop.sh"
    echo "   View logs:          docker-compose logs -f"
    echo "   Reset database:    ./scripts/reset-db.sh"
    echo "   Redeploy contracts: ./scripts/deploy-contracts.sh"
    echo ""
    echo "📚 Next Steps:"
    echo "   1. Open http://localhost:3000 in your browser"
    echo "   2. Connect your wallet (MetaMask, etc.)"
    echo "   3. Import the admin account or register a new user"
    echo "   4. Start managing your inventory!"
    echo ""
    echo "⚠️  Important Notes:"
    echo "   - This is a development environment with test data"
    echo "   - Private keys are stored in .env file (keep it secure)"
    echo "   - All services are running in Docker containers"
    echo "   - Blockchain data resets when you stop the Hardhat node"
    echo ""
}

# Cleanup function
cleanup() {
    print_step "Cleaning up..."
    
    # Kill background processes
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$AI_AGENTS_PID" ]; then
        kill $AI_AGENTS_PID 2>/dev/null || true
    fi
    
    print_status "Cleanup completed"
}

# Set up signal handlers
trap cleanup EXIT INT TERM

# Main deployment flow
main() {
    check_requirements
    setup_environment
    start_infrastructure
    setup_database
    deploy_contracts
    update_configuration
    start_backend
    start_frontend
    start_ai_agents
    run_health_checks
    display_summary
    
    print_status "Deployment is complete. Press Ctrl+C to stop all services."
    
    # Keep script running
    wait
}

# Run main function
main