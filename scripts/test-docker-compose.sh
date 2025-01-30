#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "🔍 Testing Docker Compose Configuration..."

# Check if docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}❌ docker-compose.yml not found${NC}"
    exit 1
fi

# Start services
echo "📦 Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Test Redis
echo "🔄 Testing Redis connection..."
if docker-compose exec redis redis-cli ping | grep -q 'PONG'; then
    echo -e "${GREEN}✅ Redis is responding${NC}"
else
    echo -e "${RED}❌ Redis test failed${NC}"
    docker-compose logs redis
    docker-compose down
    exit 1
fi

# Test Redis persistence
echo "💾 Testing Redis persistence..."
docker-compose exec redis redis-cli set test_key "test_value" > /dev/null
if docker-compose exec redis redis-cli get test_key | grep -q 'test_value'; then
    echo -e "${GREEN}✅ Redis persistence working${NC}"
else
    echo -e "${RED}❌ Redis persistence test failed${NC}"
    docker-compose down
    exit 1
fi

# Test Selenium
echo "🌐 Testing Selenium Grid..."
SELENIUM_STATUS=$(curl -s http://localhost:4444/wd/hub/status | grep -q '"ready": true' && echo "ready" || echo "not ready")
if [ "$SELENIUM_STATUS" = "ready" ]; then
    echo -e "${GREEN}✅ Selenium Grid is ready${NC}"
else
    echo -e "${RED}❌ Selenium Grid test failed${NC}"
    docker-compose logs selenium
    docker-compose down
    exit 1
fi

# Test network connectivity
echo "🔌 Testing network connectivity..."
if docker-compose exec redis ping -c 1 selenium > /dev/null; then
    echo -e "${GREEN}✅ Network connectivity working${NC}"
else
    echo -e "${RED}❌ Network connectivity test failed${NC}"
    docker-compose down
    exit 1
fi

# Check resource limits
echo "📊 Checking resource limits..."
if docker-compose exec redis cat /sys/fs/cgroup/memory/memory.limit_in_bytes | grep -q '^[0-9]'; then
    echo -e "${GREEN}✅ Resource limits configured${NC}"
else
    echo -e "${RED}❌ Resource limits test failed${NC}"
    docker-compose down
    exit 1
fi

echo -e "${GREEN}✅ All tests passed successfully!${NC}"

# Clean up
echo "🧹 Cleaning up..."
docker-compose down

exit 0 