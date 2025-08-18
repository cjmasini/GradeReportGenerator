@echo off
echo Building Grade Report Generator...

REM Clean previous builds
echo Cleaning previous builds...
if exist dist rmdir /s /q dist
if exist pydist rmdir /s /q pydist
if exist build-py rmdir /s /q build-py

REM Activate virtual environment if it exists
if exist .venv\Scripts\activate.bat (
    echo Activating virtual environment...
    call .venv\Scripts\activate.bat
) else (
    echo No virtual environment found. Using system Python.
)

REM Build Python backend
echo Building Python backend...
pyinstaller report-backend.spec --distpath pydist --workpath build-py --clean --noconfirm
if %ERRORLEVEL% NEQ 0 (
    echo Python build failed!
    exit /b 1
)

REM Check if Python executable was created
if not exist pydist\report-backend.exe (
    echo Python executable not found!
    exit /b 1
)

echo Python backend built successfully.

REM Install Node dependencies if needed
if not exist node_modules (
    echo Installing Node dependencies...
    npm install
)

REM Build Electron app
echo Building Electron installer...
npx electron-builder --win nsis --publish=never
if %ERRORLEVEL% NEQ 0 (
    echo Electron build failed!
    exit /b 1
)

echo Build completed successfully!
echo Installer can be found in the 'dist' folder.
pause