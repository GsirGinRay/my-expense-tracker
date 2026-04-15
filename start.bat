@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在啟動記帳網站...
echo 關閉此視窗即可停止伺服器。
echo.
start "" http://localhost:8765/
python -m http.server 8765
