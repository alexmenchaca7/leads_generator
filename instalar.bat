@echo off
chcp 65001 >nul
title Motor de busquedas - Instalacion
cd /d "%~dp0"

echo ============================================================
echo   Motor de busquedas - Instalacion (solo se hace una vez)
echo ============================================================
echo.

echo [1/2] Instalando componentes necesarios...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if errorlevel 1 (
  echo.
  echo  ERROR: no se pudo instalar. Revisa que Python este instalado
  echo  y que marcaste "Add Python to PATH" al instalarlo.
  echo.
  pause
  exit /b 1
)

echo.
echo [2/2] Instalando el navegador para las busquedas...
python -m playwright install chromium
if errorlevel 1 (
  echo.
  echo  ERROR: no se pudo instalar el navegador.
  echo.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   LISTO. Ya puedes cerrar esta ventana.
echo   Ahora abre "start_worker.bat" para encender el motor.
echo ============================================================
echo.
pause
