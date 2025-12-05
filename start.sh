#!/bin/bash

echo "🚀 Starting ESPRO Collective App with Docker..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "✓ Docker is running"
echo ""

# Check if .env file exists in backend
if [ ! -f backend/.env ]; then
    echo "⚠️  No .env file found in backend/"
    echo "📝 Please create backend/.env with required environment variables"
    echo "   See backend/.env.example for reference"
    echo ""
fi

echo "🔨 Building Docker images..."
docker-compose build

echo ""
echo "🐳 Starting containers..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

echo ""
echo "✅ ESPRO Collective App is running!"
echo ""
echo "📍 Access the application:"
echo "   Frontend: http://localhost:5175"
echo "   Backend API: http://localhost:9002"
echo "   MongoDB: localhost:27019"
echo ""
echo "📋 Useful commands:"
echo "   View logs: docker-compose logs -f"
echo "   Stop: docker-compose down"
echo "   Restart: docker-compose restart"
echo "   View all logs: docker-compose logs -f"
echo ""

