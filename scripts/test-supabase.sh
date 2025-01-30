#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging setup
LOG_FILE="supabase-tests.log"
exec 1> >(tee -a "$LOG_FILE") 2>&1

echo "🔍 Testing Supabase Setup $(date)"

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

# Test Supabase Services
test_services() {
    echo -e "\n${YELLOW}🔄 Testing Supabase Services${NC}"
    
    # Test Studio
    echo "Testing Studio access..."
    if curl -s http://localhost:54323 > /dev/null; then
        echo -e "${GREEN}✅ Studio is accessible${NC}"
        log_test "Studio Access" "PASS"
    else
        echo -e "${RED}❌ Studio is not accessible${NC}"
        log_test "Studio Access" "FAIL"
        return 1
    fi

    # Test API
    echo "Testing API access..."
    if curl -s http://localhost:54321/rest/v1/ -H "apikey: $(supabase status | grep 'anon key:' | awk '{print $3}')" > /dev/null; then
        echo -e "${GREEN}✅ API is accessible${NC}"
        log_test "API Access" "PASS"
    else
        echo -e "${RED}❌ API is not accessible${NC}"
        log_test "API Access" "FAIL"
        return 1
    fi
}

# Test Database
test_database() {
    echo -e "\n${YELLOW}📊 Testing Database${NC}"
    
    # Test connection
    echo "Testing database connection..."
    if supabase db ping > /dev/null; then
        echo -e "${GREEN}✅ Database connection successful${NC}"
        log_test "Database Connection" "PASS"
    else
        echo -e "${RED}❌ Database connection failed${NC}"
        log_test "Database Connection" "FAIL"
        return 1
    fi

    # Test migrations
    echo "Testing migrations..."
    if supabase db reset -f > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Migrations applied successfully${NC}"
        log_test "Migrations" "PASS"
    else
        echo -e "${RED}❌ Migration application failed${NC}"
        log_test "Migrations" "FAIL"
        return 1
    fi
}

# Test Auth
test_auth() {
    echo -e "\n${YELLOW}🔐 Testing Auth${NC}"
    
    # Test signup
    echo "Testing user signup..."
    SIGNUP_RESPONSE=$(curl -s -X POST http://localhost:54321/auth/v1/signup \
        -H "apikey: $(supabase status | grep 'anon key:' | awk '{print $3}')" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"Test123!@#"}')
    
    if echo "$SIGNUP_RESPONSE" | grep -q "access_token"; then
        echo -e "${GREEN}✅ User signup successful${NC}"
        log_test "User Signup" "PASS"
        
        # Extract access token
        ACCESS_TOKEN=$(echo "$SIGNUP_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
        
        # Test profile creation trigger
        echo "Testing profile creation trigger..."
        sleep 2
        PROFILE_CHECK=$(curl -s http://localhost:54321/rest/v1/profiles?id=eq.$(echo "$SIGNUP_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4) \
            -H "apikey: $(supabase status | grep 'anon key:' | awk '{print $3}')" \
            -H "Authorization: Bearer $ACCESS_TOKEN")
        
        if echo "$PROFILE_CHECK" | grep -q "id"; then
            echo -e "${GREEN}✅ Profile creation trigger working${NC}"
            log_test "Profile Trigger" "PASS"
        else
            echo -e "${RED}❌ Profile creation trigger failed${NC}"
            log_test "Profile Trigger" "FAIL"
            return 1
        fi
    else
        echo -e "${RED}❌ User signup failed${NC}"
        log_test "User Signup" "FAIL"
        return 1
    fi
}

# Test Storage
test_storage() {
    echo -e "\n${YELLOW}📦 Testing Storage${NC}"
    
    # Test bucket creation
    echo "Testing bucket creation..."
    if supabase storage create-bucket test-bucket > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Storage bucket created successfully${NC}"
        log_test "Storage Bucket Creation" "PASS"
        
        # Clean up
        supabase storage remove-bucket test-bucket > /dev/null 2>&1
    else
        echo -e "${RED}❌ Storage bucket creation failed${NC}"
        log_test "Storage Bucket Creation" "FAIL"
        return 1
    fi
}

# Test Edge Functions
test_edge_functions() {
    echo -e "\n${YELLOW}⚡ Testing Edge Functions${NC}"
    
    # Create test function
    mkdir -p supabase/functions/hello
    echo 'export const handler = async () => new Response("Hello World")' > supabase/functions/hello/index.ts
    
    # Deploy function
    echo "Testing edge function deployment..."
    if supabase functions deploy hello > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Edge function deployed successfully${NC}"
        log_test "Edge Function Deployment" "PASS"
        
        # Test function invocation
        RESPONSE=$(curl -s http://localhost:54321/functions/v1/hello)
        if [ "$RESPONSE" = "Hello World" ]; then
            echo -e "${GREEN}✅ Edge function execution successful${NC}"
            log_test "Edge Function Execution" "PASS"
        else
            echo -e "${RED}❌ Edge function execution failed${NC}"
            log_test "Edge Function Execution" "FAIL"
            return 1
        fi
    else
        echo -e "${RED}❌ Edge function deployment failed${NC}"
        log_test "Edge Function Deployment" "FAIL"
        return 1
    fi
}

# Run all tests
main() {
    test_services || exit 1
    test_database || exit 1
    test_auth || exit 1
    test_storage || exit 1
    test_edge_functions || exit 1
    
    echo -e "\n${GREEN}✅ All Supabase tests completed successfully!${NC}"
    echo "Detailed logs available in: $LOG_FILE"
}

main 