#!/bin/bash

echo "🔍 Monitoring Railway Deployment..."
echo "Checking every 30 seconds for deployment updates"
echo "Press Ctrl+C to stop"
echo ""

LAST_MODIFIED=""

while true; do
  TIMESTAMP=$(date "+%H:%M:%S")
  
  # Get the last-modified header
  CURRENT_MODIFIED=$(curl -s -I https://glossiboardupdate-production.up.railway.app/pr.html 2>&1 | grep -i "last-modified" | cut -d' ' -f2-)
  
  # Get HTTP status
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://glossiboardupdate-production.up.railway.app/pr.html 2>&1)
  
  if [ -z "$LAST_MODIFIED" ]; then
    LAST_MODIFIED="$CURRENT_MODIFIED"
    echo "[$TIMESTAMP] Initial check - Status: $HTTP_STATUS"
    echo "[$TIMESTAMP] Last Modified: $CURRENT_MODIFIED"
    echo ""
  elif [ "$CURRENT_MODIFIED" != "$LAST_MODIFIED" ]; then
    echo ""
    echo "🎉 ============================================"
    echo "🎉 DEPLOYMENT DETECTED!"
    echo "🎉 ============================================"
    echo "[$TIMESTAMP] Status: $HTTP_STATUS"
    echo "[$TIMESTAMP] Previous: $LAST_MODIFIED"
    echo "[$TIMESTAMP] Current:  $CURRENT_MODIFIED"
    echo ""
    echo "✅ Typography changes should now be live!"
    echo "🌐 Open: https://glossiboardupdate-production.up.railway.app/pr.html"
    echo "💡 Hard refresh: Cmd+Shift+R to see changes"
    echo ""
    
    # Ring the terminal bell
    echo -e "\a"
    
    LAST_MODIFIED="$CURRENT_MODIFIED"
  else
    echo "[$TIMESTAMP] Status: $HTTP_STATUS - No deployment yet (checking...)"
  fi
  
  sleep 30
done
