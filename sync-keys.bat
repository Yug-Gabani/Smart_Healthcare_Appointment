@echo off
title Syncing Razorpay Keys from application.yml...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\sync-config.ps1" -RestartBackend
pause

