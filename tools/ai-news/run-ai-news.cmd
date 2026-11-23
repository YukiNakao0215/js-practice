@echo off
rem Windowsタスクスケジューラから呼ぶ用のラッパー。
rem このファイルと同じ場所に ai-news.config.json を置いてください。
rem 文字化けを防ぐためコンソールをUTF-8にしてから実行します。
chcp 65001 > nul
setlocal
set SCRIPT_DIR=%~dp0
node "%SCRIPT_DIR%bin\ai-news.js" --quiet --config "%SCRIPT_DIR%ai-news.config.json" >> "%SCRIPT_DIR%ai-news.log" 2>&1
exit /b %ERRORLEVEL%
