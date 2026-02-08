#!/bin/bash

echo "🚀 Starting Deployment..."

# 1. Pull Latest Changes
git pull origin main

# 2. Check for .env file
if [ ! -f .env ]; then
    echo "⚠️ .env file not found!"
    if [ -f .env.example ]; then
        echo "📄 Creating .env from .env.example..."
        cp .env.example .env
        echo "✅ .env created. Please edit if needed."
    else
        echo "❌ .env.example missing. Cannot create .env."
        exit 1
    fi
fi

# 3. Rebuild and Restart Containers
echo "🔄 Rebuilding and Restarting Containers..."
sudo docker compose down
sudo docker compose up -d --build --force-recreate

echo "✅ Deployment Complete!"
echo "➡️  Access at https://story-sign.34.56.135.222.nip.io"
