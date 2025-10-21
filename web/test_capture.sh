#!/usr/bin/env bash
# Simple test script to call the capture API
curl -X POST http://localhost:3000/api/capture -H "Content-Type: application/json" \
  -d '{"output":"test.csv","iface":"","filter":"both","duration":5}'
