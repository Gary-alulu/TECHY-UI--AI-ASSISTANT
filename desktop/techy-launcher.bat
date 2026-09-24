@echo off
rem TECHY Desktop Launcher
rem Global Ctrl+Space overlay + clipboard watch, talks to the local TECHY server.
rem Smoke test:  techy-launcher.bat --smoke
setlocal

if /i "%~1"=="--smoke" (
  powershell.exe -NoProfile -Sta -ExecutionPolicy Bypass -File "%~dp0TechyLauncher.ps1" -SmokeTest
  goto :eof
)

powershell.exe -NoProfile -Sta -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0TechyLauncher.ps1"