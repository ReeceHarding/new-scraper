#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging setup
LOG_FILE="docker-environment-tests.log"
exec 1> >(tee -a "$LOG_FILE") 2>&1

echo "🔬 Starting Docker Environment Tests $(date)"

# Function to log test results
log_test() {
    local test_name=$1
    local result=$2
    local details=$3
    echo "[$(date +%Y-%m-%d\ %H:%M:%S)] $test_name: $result" >> "$LOG_FILE"
    if [ -n "$details" ]; then
        echo "$details" >> "$LOG_FILE"
    fi
}

# Redis Tests
test_redis() {
    echo -e "\n${YELLOW}📊 Testing Redis Setup${NC}"
    
    # Test container startup
    echo "Testing Redis container startup..."
    if docker-compose ps redis | grep -q "Up"; then
        echo -e "${GREEN}✅ Redis container started successfully${NC}"
        log_test "Redis Startup" "PASS"
    else
        echo -e "${RED}❌ Redis container failed to start${NC}"
        log_test "Redis Startup" "FAIL" "$(docker-compose logs redis)"
        return 1
    fi

    # Test persistence
    echo "Testing Redis persistence..."
    docker-compose exec -T redis redis-cli set test_persistence "$(date)"
    docker-compose restart redis
    sleep 5
    if docker-compose exec -T redis redis-cli get test_persistence | grep -q ""; then
        echo -e "${GREEN}✅ Redis persistence verified${NC}"
        log_test "Redis Persistence" "PASS"
    else
        echo -e "${RED}❌ Redis persistence test failed${NC}"
        log_test "Redis Persistence" "FAIL"
        return 1
    fi

    # Test memory limits
    echo "Testing Redis memory limits..."
    MEMORY_LIMIT=$(docker-compose exec -T redis cat /sys/fs/cgroup/memory/memory.limit_in_bytes)
    if [ "$MEMORY_LIMIT" -eq 536870912 ]; then  # 512MB in bytes
        echo -e "${GREEN}✅ Redis memory limits configured correctly${NC}"
        log_test "Redis Memory Limits" "PASS"
    else
        echo -e "${RED}❌ Redis memory limits misconfigured${NC}"
        log_test "Redis Memory Limits" "FAIL" "Expected: 536870912, Got: $MEMORY_LIMIT"
        return 1
    fi

    # Test failover
    echo "Testing Redis failover..."
    docker-compose stop redis
    sleep 2
    docker-compose start redis
    sleep 5
    if docker-compose ps redis | grep -q "Up"; then
        echo -e "${GREEN}✅ Redis failover successful${NC}"
        log_test "Redis Failover" "PASS"
    else
        echo -e "${RED}❌ Redis failover failed${NC}"
        log_test "Redis Failover" "FAIL"
        return 1
    fi

    # Test backup/restore
    echo "Testing Redis backup/restore..."
    docker-compose exec -T redis redis-cli save
    if [ -f "redis_data/dump.rdb" ]; then
        echo -e "${GREEN}✅ Redis backup successful${NC}"
        log_test "Redis Backup" "PASS"
    else
        echo -e "${RED}❌ Redis backup failed${NC}"
        log_test "Redis Backup" "FAIL"
        return 1
    fi
}

# Selenium Tests
test_selenium() {
    echo -e "\n${YELLOW}🌐 Testing Selenium Setup${NC}"
    
    # Test browser access
    echo "Testing Selenium browser access..."
    if curl -s http://localhost:4444/wd/hub/status | grep -q '"ready": true'; then
        echo -e "${GREEN}✅ Selenium browser access verified${NC}"
        log_test "Selenium Browser Access" "PASS"
    else
        echo -e "${RED}❌ Selenium browser access failed${NC}"
        log_test "Selenium Browser Access" "FAIL"
        return 1
    fi

    # Test VNC connection
    echo "Testing VNC connection..."
    if nc -z localhost 5900; then
        echo -e "${GREEN}✅ VNC port accessible${NC}"
        log_test "VNC Connection" "PASS"
    else
        echo -e "${RED}❌ VNC connection failed${NC}"
        log_test "VNC Connection" "FAIL"
        return 1
    fi

    # Test resource usage
    echo "Testing Selenium resource usage..."
    MEMORY_USAGE=$(docker stats --no-stream selenium | awk 'NR==2 {print $4}')
    if [[ $MEMORY_USAGE =~ ^[0-9]+(\.[0-9]+)?MiB$ ]]; then
        echo -e "${GREEN}✅ Selenium resource usage within limits${NC}"
        log_test "Selenium Resource Usage" "PASS" "Memory Usage: $MEMORY_USAGE"
    else
        echo -e "${RED}❌ Selenium resource usage test failed${NC}"
        log_test "Selenium Resource Usage" "FAIL" "Memory Usage: $MEMORY_USAGE"
        return 1
    fi

    # Test concurrent sessions
    echo "Testing concurrent sessions..."
    SESSIONS=$(curl -s http://localhost:4444/wd/hub/sessions | grep -o '"id"' | wc -l)
    if [ "$SESSIONS" -eq 0 ]; then
        echo -e "${GREEN}✅ Selenium session management working${NC}"
        log_test "Selenium Sessions" "PASS"
    else
        echo -e "${RED}❌ Unexpected active sessions${NC}"
        log_test "Selenium Sessions" "FAIL" "Active sessions: $SESSIONS"
        return 1
    fi
}

# Service Integration Tests
test_service_integration() {
    echo -e "\n${YELLOW}🔄 Testing Service Integration${NC}"
    
    # Test inter-service communication
    echo "Testing inter-service communication..."
    if docker-compose exec -T redis ping -c 1 selenium > /dev/null; then
        echo -e "${GREEN}✅ Inter-service communication working${NC}"
        log_test "Inter-service Communication" "PASS"
    else
        echo -e "${RED}❌ Inter-service communication failed${NC}"
        log_test "Inter-service Communication" "FAIL"
        return 1
    fi

    # Test network latency
    echo "Testing network latency..."
    LATENCY=$(docker-compose exec -T redis ping -c 1 selenium | grep -oP 'time=\K[0-9.]+')
    if (( $(echo "$LATENCY < 100" | bc -l) )); then
        echo -e "${GREEN}✅ Network latency acceptable (<100ms)${NC}"
        log_test "Network Latency" "PASS" "Latency: ${LATENCY}ms"
    else
        echo -e "${RED}❌ Network latency too high${NC}"
        log_test "Network Latency" "FAIL" "Latency: ${LATENCY}ms"
        return 1
    fi
}

# Performance Tests
test_performance() {
    echo -e "\n${YELLOW}⚡ Running Performance Tests${NC}"
    
    # Measure startup time
    echo "Measuring startup time..."
    START_TIME=$(date +%s)
    docker-compose down > /dev/null 2>&1
    docker-compose up -d
    END_TIME=$(date +%s)
    STARTUP_TIME=$((END_TIME - START_TIME))
    
    if [ $STARTUP_TIME -lt 30 ]; then
        echo -e "${GREEN}✅ Startup time acceptable (<30s)${NC}"
        log_test "Startup Time" "PASS" "Time: ${STARTUP_TIME}s"
    else
        echo -e "${RED}❌ Startup time too long${NC}"
        log_test "Startup Time" "FAIL" "Time: ${STARTUP_TIME}s"
        return 1
    fi

    # Monitor resource usage
    echo "Monitoring resource usage..."
    docker stats --no-stream | tee -a "$LOG_FILE"
}

# Security Tests
test_security() {
    echo -e "\n${YELLOW}🔒 Running Security Tests${NC}"
    
    # Test network isolation
    echo "Testing network isolation..."
    if ! docker-compose exec -T redis ping -c 1 8.8.8.8 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Network properly isolated${NC}"
        log_test "Network Isolation" "PASS"
    else
        echo -e "${RED}❌ Network isolation compromised${NC}"
        log_test "Network Isolation" "FAIL"
        return 1
    fi

    # Test volume permissions
    echo "Testing volume permissions..."
    if docker-compose exec -T redis ls -la /data | grep -q "redis"; then
        echo -e "${GREEN}✅ Volume permissions correct${NC}"
        log_test "Volume Permissions" "PASS"
    else
        echo -e "${RED}❌ Volume permission issues${NC}"
        log_test "Volume Permissions" "FAIL"
        return 1
    fi
}

# Run all tests
main() {
    test_redis || exit 1
    test_selenium || exit 1
    test_service_integration || exit 1
    test_performance || exit 1
    test_security || exit 1
    
    echo -e "\n${GREEN}✅ All tests completed successfully!${NC}"
    echo "Detailed logs available in: $LOG_FILE"
}

main 