#!/usr/bin/env bash
set -euo pipefail

sudo apt update
sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
npm install
npm install -g pm2
cp -n .env.example .env || true
printf '\nNext: edit .env, then run: npm start\nFor PM2: pm2 start npm --name dark-market -- start && pm2 save\n'
