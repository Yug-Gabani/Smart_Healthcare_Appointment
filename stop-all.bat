@echo off
title Stopping PulseCare Full-Stack System...
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-all.ps1"
pause
