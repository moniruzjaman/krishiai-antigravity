@echo off
echo Activating virtual environment...
call venv\Scripts\activate.bat

echo.
echo Starting Krishi AI Backend Server...
echo API will be available at: http://localhost:8000
echo API Docs will be available at: http://localhost:8000/docs
echo.

python -m app.main
