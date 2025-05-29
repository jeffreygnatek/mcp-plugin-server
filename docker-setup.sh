#!/bin/bash

# Docker Setup Script for MCP Plugin Server
# This script helps you set up and run the MCP Plugin Server in Docker

set -e

echo "🐳 MCP Plugin Server Docker Setup"
echo "=================================="

# Function to generate a secure random key
generate_key() {
    openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | base64 | tr -d "=+/" | cut -c1-32
}

# Function to check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker is not installed. Please install Docker first."
        echo "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo "❌ Docker Compose is not installed. Please install Docker Compose first."
        echo "Visit: https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    echo "✅ Docker and Docker Compose are installed"
}

# Function to create .env file if it doesn't exist
setup_env() {
    if [ ! -f .env ]; then
        echo "📝 Creating .env file with secure defaults..."
        
        MASTER_KEY=$(generate_key)
        ADMIN_TOKEN=$(generate_key)
        
        cat > .env << EOF
# MCP Plugin Server Environment Configuration
NODE_ENV=production
PORT=3000

# Security Configuration
MASTER_KEY=${MASTER_KEY}
ADMIN_TOKEN=${ADMIN_TOKEN}

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Add your custom configuration below:
EOF
        
        echo "✅ Created .env file with secure random keys"
        echo "⚠️  IMPORTANT: Save your ADMIN_TOKEN: ${ADMIN_TOKEN}"
        echo "   You'll need this to access admin endpoints"
    else
        echo "✅ .env file already exists"
    fi
}

# Function to create necessary directories
create_directories() {
    echo "📁 Creating necessary directories..."
    mkdir -p data plugins config
    echo "✅ Directories created"
}

# Function to build and start containers
start_containers() {
    local mode=${1:-production}
    
    if [ "$mode" = "development" ] || [ "$mode" = "dev" ]; then
        echo "🚀 Starting in development mode..."
        docker-compose -f docker-compose.dev.yml up --build -d
        echo "✅ Development server started!"
        echo "📊 Server: http://localhost:3000"
        echo "🔍 Health check: http://localhost:3000/health"
        echo "🐛 Debug port: 9229"
    else
        echo "🚀 Starting in production mode..."
        docker-compose up --build -d
        echo "✅ Production server started!"
        echo "📊 Server: http://localhost:3000"
        echo "🔍 Health check: http://localhost:3000/health"
    fi
}

# Function to show logs
show_logs() {
    local mode=${1:-production}
    
    if [ "$mode" = "development" ] || [ "$mode" = "dev" ]; then
        docker-compose -f docker-compose.dev.yml logs -f
    else
        docker-compose logs -f
    fi
}

# Function to stop containers
stop_containers() {
    echo "🛑 Stopping containers..."
    docker-compose down
    docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
    echo "✅ Containers stopped"
}

# Function to show status
show_status() {
    echo "📊 Container Status:"
    docker-compose ps
    docker-compose -f docker-compose.dev.yml ps 2>/dev/null || true
}

# Main script logic
case "${1:-setup}" in
    "setup"|"start")
        check_docker
        setup_env
        create_directories
        start_containers "${2:-production}"
        ;;
    "dev"|"development")
        check_docker
        setup_env
        create_directories
        start_containers "development"
        ;;
    "logs")
        show_logs "${2:-production}"
        ;;
    "stop")
        stop_containers
        ;;
    "restart")
        stop_containers
        start_containers "${2:-production}"
        ;;
    "status")
        show_status
        ;;
    "clean")
        echo "🧹 Cleaning up Docker resources..."
        docker-compose down -v --remove-orphans
        docker-compose -f docker-compose.dev.yml down -v --remove-orphans 2>/dev/null || true
        docker system prune -f
        echo "✅ Cleanup complete"
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [COMMAND] [MODE]"
        echo ""
        echo "Commands:"
        echo "  setup, start [MODE]  Setup and start the server (default: production)"
        echo "  dev, development     Start in development mode"
        echo "  logs [MODE]          Show container logs"
        echo "  stop                 Stop all containers"
        echo "  restart [MODE]       Restart containers"
        echo "  status               Show container status"
        echo "  clean                Clean up Docker resources"
        echo "  help                 Show this help message"
        echo ""
        echo "Modes:"
        echo "  production          Production mode (default)"
        echo "  development, dev    Development mode with hot reload"
        echo ""
        echo "Examples:"
        echo "  $0 setup             # Setup and start in production mode"
        echo "  $0 dev               # Start in development mode"
        echo "  $0 logs dev          # Show development logs"
        echo "  $0 restart production # Restart in production mode"
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac 