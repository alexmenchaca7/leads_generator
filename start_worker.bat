@echo off
chcp 65001 >nul
title Motor de busquedas (dejar abierto)
cd /d "%~dp0"

echo ============================================================
echo   Motor de busquedas ENCENDIDO
echo   Deja esta ventana ABIERTA. Procesa las busquedas que
echo   lanzas desde el dashboard. Si la cierras, el dashboard
echo   dira "apagado".
echo ============================================================
echo.

:loop
python -m src.worker
echo.
echo  El motor se detuvo. Reiniciando en 10 segundos...
echo  (cierra esta ventana si quieres apagarlo de verdad)
timeout /t 10 /nobreak >nul
goto loop
