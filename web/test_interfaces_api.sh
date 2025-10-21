#!/bin/bash

echo "Testing /api/interfaces endpoint..."
echo ""

# Give server time to start
sleep 2

# Test the endpoint
echo "Calling http://localhost:3000/api/interfaces..."
curl -v http://localhost:3000/api/interfaces 2>&1

echo ""
echo "Done!"
