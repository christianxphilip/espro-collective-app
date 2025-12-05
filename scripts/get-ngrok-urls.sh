#!/bin/bash

# Script to get ngrok URLs and update frontend configuration

echo "Fetching ngrok URLs..."

# Get backend ngrok URL
BACKEND_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*' | grep -o 'https://[^"]*' | head -1)

# Get customer portal ngrok URL
CUSTOMER_URL=$(curl -s http://localhost:4041/api/tunnels | grep -o '"public_url":"[^"]*' | grep -o 'https://[^"]*' | head -1)

if [ -z "$BACKEND_URL" ]; then
    echo "Error: Could not get backend ngrok URL. Is ngrok-backend running?"
    exit 1
fi

if [ -z "$CUSTOMER_URL" ]; then
    echo "Error: Could not get customer portal ngrok URL. Is ngrok-customer running?"
    exit 1
fi

echo ""
echo "=========================================="
echo "Ngrok URLs:"
echo "=========================================="
echo "Backend API:     $BACKEND_URL"
echo "Customer Portal: $CUSTOMER_URL"
echo ""
echo "To use these URLs in the customer portal,"
echo "open the browser console and run:"
echo ""
echo "localStorage.setItem('BACKEND_NGROK_URL', '$BACKEND_URL/api');"
echo ""
echo "Then refresh the page."
echo "=========================================="

