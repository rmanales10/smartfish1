@echo off
REM Simple file transfer script - Run from SmartFishCare directory
REM Make sure you're in: C:\Users\manal\Desktop\SmartFishCare

set SERVER_IP=45.130.165.180
set SERVER_USER=root

echo ============================================
echo Transferring files to Ubuntu server
echo ============================================
echo.
echo Make sure you're in: C:\Users\manal\Desktop\SmartFishCare
echo Current directory: %CD%
echo.
pause

echo.
echo Step 1: Creating directories (already done, skipping...)
echo.

echo Step 2: Transferring backend files...
echo Enter password when prompted: SmartFishCare2025
echo.
pushd backend
for /d %%d in (*) do (
    echo Transferring directory: %%d
    scp -r "%%d" %SERVER_USER%@%SERVER_IP%:/opt/smartfishcare/backend/
)
for %%f in (*.*) do (
    echo Transferring file: %%f
    scp "%%f" %SERVER_USER%@%SERVER_IP%:/opt/smartfishcare/backend/
)
popd

if errorlevel 1 (
    echo.
    echo ERROR: Failed to transfer backend files
    echo.
    echo Trying alternative method...
    echo.
    scp -r backend %SERVER_USER%@%SERVER_IP%:/opt/smartfishcare/
    if errorlevel 1 (
        pause
        exit /b 1
    ) else (
        echo Success! Files transferred to /opt/smartfishcare/backend/
    )
) else (
    echo.
    echo ✅ Backend files transferred successfully!
)

echo.
echo Step 3: Transferring model files...
if exist fish_detection_repo (
    echo Enter password when prompted: SmartFishCare2025
    echo.
    scp -r fish_detection_repo %SERVER_USER%@%SERVER_IP%:/opt/smartfishcare/
    
    if errorlevel 1 (
        echo.
        echo ERROR: Failed to transfer model files
        pause
        exit /b 1
    ) else (
        echo.
        echo ✅ Model files transferred successfully!
    )
) else (
    echo WARNING: fish_detection_repo directory not found. Skipping...
)

echo.
echo ============================================
echo Transfer complete!
echo ============================================
echo.
echo Next steps:
echo 1. SSH into server: ssh %SERVER_USER%@%SERVER_IP%
echo 2. Run: cd /opt/smartfishcare/backend
echo 3. Run: chmod +x deploy-to-ubuntu.sh
echo 4. Run: sudo ./deploy-to-ubuntu.sh
echo.
pause

