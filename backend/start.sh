#!/bin/bash
# Start Vulpine OS Backend

cd "$(dirname "$0")"

echo "Starting Vulpine OS Backend..."
./venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload
