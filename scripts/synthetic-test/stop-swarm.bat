@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0swarm-launcher.ps1" -Action Stop
pause