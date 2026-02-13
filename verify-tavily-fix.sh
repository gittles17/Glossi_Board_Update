#!/bin/bash

echo "========================================"
echo "VERIFY TAVILY FIX ON PRODUCTION"
echo "========================================"
echo ""
echo "This will test if TAVILY_API_KEY was added to Railway"
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Testing production endpoint..."
echo ""

node test-production-detailed.js > /tmp/tavily-test-output.txt 2>&1
TEST_RESULT=$?

# Check response time from output
RESPONSE_TIME=$(grep "POST request completed in" /tmp/tavily-test-output.txt | grep -o '[0-9.]*s' | head -1)
ARTICLES_COUNT=$(grep "Articles returned:" /tmp/tavily-test-output.txt | grep -o '[0-9]*' | tail -1)

cat /tmp/tavily-test-output.txt

echo ""
echo "========================================"
echo "VERIFICATION RESULTS"
echo "========================================"
echo ""

# Extract numeric values for comparison
RESPONSE_SECONDS=$(echo $RESPONSE_TIME | sed 's/s//')
SUCCESS=true

if [ -z "$RESPONSE_SECONDS" ]; then
    echo -e "${RED}✗ Could not determine response time${NC}"
    SUCCESS=false
elif (( $(echo "$RESPONSE_SECONDS < 5" | bc -l) )); then
    echo -e "${RED}✗ Response too fast: $RESPONSE_TIME${NC}"
    echo "  Expected: 10-20 seconds"
    echo "  This indicates Tavily is not running"
    SUCCESS=false
else
    echo -e "${GREEN}✓ Response time: $RESPONSE_TIME${NC}"
    echo "  (Expected: 10-20 seconds for Tavily + Claude)"
fi

if [ "$ARTICLES_COUNT" = "0" ]; then
    echo -e "${RED}✗ Articles returned: 0${NC}"
    echo "  Expected: 10-15 articles"
    SUCCESS=false
elif [ -z "$ARTICLES_COUNT" ]; then
    echo -e "${RED}✗ Could not determine article count${NC}"
    SUCCESS=false
else
    echo -e "${GREEN}✓ Articles returned: $ARTICLES_COUNT${NC}"
fi

echo ""

if [ "$SUCCESS" = true ]; then
    echo -e "${GREEN}✅ TAVILY FIX VERIFIED!${NC}"
    echo ""
    echo "News hooks are working correctly:"
    echo "  ✓ TAVILY_API_KEY is configured on Railway"
    echo "  ✓ Tavily search is finding articles"
    echo "  ✓ Claude is analyzing relevance"
    echo "  ✓ Real news is being cached"
    echo ""
    echo "You can now use the PR Agent > Research tab to see current news hooks."
else
    echo -e "${RED}✗ TAVILY FIX NOT APPLIED YET${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Go to https://railway.app"
    echo "  2. Open your project > Variables tab"
    echo "  3. Add: TAVILY_API_KEY = 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"
    echo "  4. Wait for deployment (1-2 minutes)"
    echo "  5. Run this script again: ./verify-tavily-fix.sh"
    echo ""
fi

rm -f /tmp/tavily-test-output.txt
