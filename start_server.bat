@echo off
cd /d "%~dp0"
echo Starting Team Trials Tracker on http://localhost:3001
echo Progress is saved to data.json in this folder - keep this window open while you use the tracker.
start "" http://localhost:3001
node server.js
