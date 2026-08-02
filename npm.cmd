@ECHO OFF
SETLOCAL
SET "NODE_EXE=%~dp0node.exe"
SET "NPM_CLI_JS=%~dp0npm-core\bin\npm-cli.js"
SET "PATH=%~dp0;%PATH%"

IF NOT EXIST "%NODE_EXE%" (
    echo Error: node.exe not found.
    exit /b 1
)

IF NOT EXIST "%NPM_CLI_JS%" (
    echo Error: npm-cli.js not found.
    exit /b 1
)

"%NODE_EXE%" "%NPM_CLI_JS%" %*
