#!/bin/bash

echo "========================================"
echo "TAVILY NEWS HOOKS TEST SUITE"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Tavily Search Only
echo "TEST 1: Tavily Search (No API keys needed)"
echo "----------------------------------------"
node test-tavily-news-hooks.js
TEST1_RESULT=$?

echo ""
echo ""

# Test 2: Full Flow (requires ANTHROPIC_API_KEY)
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "TEST 2: Full Flow (Tavily + Claude)"
    echo "----------------------------------------"
    echo -e "${YELLOW}⏭  SKIPPED: ANTHROPIC_API_KEY not set${NC}"
    echo ""
    echo "To run this test:"
    echo "  export ANTHROPIC_API_KEY=\"your-key-here\""
    echo "  node test-news-hooks-full.js"
    echo ""
    TEST2_RESULT=2
else
    echo "TEST 2: Full Flow (Tavily + Claude)"
    echo "----------------------------------------"
    node test-news-hooks-full.js
    TEST2_RESULT=$?
    echo ""
fi

echo ""

# Test 3: Endpoint Test (requires server)
echo "TEST 3: API Endpoint Test"
echo "----------------------------------------"

# Check if server is running
if curl -s http://localhost:5500/health > /dev/null 2>&1; then
    node test-news-hooks-endpoint.js
    TEST3_RESULT=$?
else
    echo -e "${YELLOW}⏭  SKIPPED: Server not running on localhost:5500${NC}"
    echo ""
    echo "To run this test:"
    echo "  Terminal 1: node server.js"
    echo "  Terminal 2: node test-news-hooks-endpoint.js"
    echo ""
    TEST3_RESULT=2
fi

echo ""
echo "========================================"
echo "TEST SUMMARY"
echo "========================================"
echo ""

if [ $TEST1_RESULT -eq 0 ]; then
    echo -e "TEST 1 (Tavily Search):     ${GREEN}✓ PASSED${NC}"
else
    echo -e "TEST 1 (Tavily Search):     ${RED}✗ FAILED${NC}"
fi

if [ $TEST2_RESULT -eq 0 ]; then
    echo -e "TEST 2 (Full Flow):         ${GREEN}✓ PASSED${NC}"
elif [ $TEST2_RESULT -eq 2 ]; then
    echo -e "TEST 2 (Full Flow):         ${YELLOW}⏭ SKIPPED${NC}"
else
    echo -e "TEST 2 (Full Flow):         ${RED}✗ FAILED${NC}"
fi

if [ $TEST3_RESULT -eq 0 ]; then
    echo -e "TEST 3 (Endpoint):          ${GREEN}✓ PASSED${NC}"
elif [ $TEST3_RESULT -eq 2 ]; then
    echo -e "TEST 3 (Endpoint):          ${YELLOW}⏭ SKIPPED${NC}"
else
    echo -e "TEST 3 (Endpoint):          ${RED}✗ FAILED${NC}"
fi

echo ""

if [ $TEST1_RESULT -eq 0 ]; then
    echo -e "${GREEN}✓ Tavily news hooks search is working!${NC}"
    echo ""
    echo "See TAVILY_TEST_RESULTS.md for detailed test results"
else
    echo -e "${RED}✗ Tests failed. Check output above for errors.${NC}"
    exit 1
fi
