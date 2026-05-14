#!/bin/bash
pkill -f npm
pkill -f localtunnel
sleep 1
nohup npm run dev > server.log 2>&1 &
sleep 5
nohup npx localtunnel --port 3000 --subdomain servicehub > tunnel.log 2>&1 &
echo "Services started in background."
