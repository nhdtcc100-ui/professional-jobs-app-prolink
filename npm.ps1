#!/usr/bin/env pwsh
$NODE_EXE = "$PSScriptRoot/node.exe"
$NPM_CLI_JS = "$PSScriptRoot/npm-core/bin/npm-cli.js"

if (-not (Test-Path $NODE_EXE)) {
    Write-Host "Error: node.exe not found in $PSScriptRoot" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $NPM_CLI_JS)) {
    Write-Host "Error: npm-cli.js not found in $NPM_CLI_JS" -ForegroundColor Red
    exit 1
}

# Add current directory to PATH so sub-processes can find node.exe
$env:PATH = "$PSScriptRoot;$env:PATH"

& "$NODE_EXE" "$NPM_CLI_JS" @args
