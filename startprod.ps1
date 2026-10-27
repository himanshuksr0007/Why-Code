# Why-Code - start the production backend and the frontend together.
#
#   .\startprod.ps1
# (If scripts are blocked: powershell -ExecutionPolicy Bypass -File .\startprod.ps1)
#
# Backend:  FastAPI production app (requires Neo4j and LLM API keys)
#           http://localhost:8000   (health check: /health)
# Frontend: Next.js at http://localhost:3000, wired to that backend.
#
# This mode requires proper configuration in backend/.env:
#   - WHYCODE_NEO4J_URI, WHYCODE_NEO4J_USER, WHYCODE_NEO4J_PASSWORD
#   - WHYCODE_LLM_API_KEY, WHYCODE_LLM_MODEL (optional)
#
# Ctrl+C stops both. The first run creates the Python venv and installs
# dependencies, so it takes a few minutes; later runs start in seconds.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$ApiPort = 8000
$WebPort = 3000 # must stay 3000: the backend CORS allows this origin only

foreach ($cmd in @("node", "npm", "python")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "Missing: $cmd - install it first (Node 20+, Python 3.12+)."
        exit 1
    }
}

# --- backend ---------------------------------------------------------------
$venvPython = "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Host "Setting up backend venv (first run)..."
    python -m venv backend\.venv
    & $venvPython -m pip install -q -e backend
}

# Load backend\.env if present
$envFile = Join-Path $PSScriptRoot "backend\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)
            $varName = $parts[0].Trim()
            $varVal = $parts[1].Trim().Trim('"').Trim("'")
            if (-not [string]::IsNullOrEmpty($varName)) {
                [System.Environment]::SetEnvironmentVariable($varName, $varVal, "Process")
            }
        }
    }
}

# Check for required Neo4j environment variables
$neo4jUri = $env:WHYCODE_NEO4J_URI
$neo4jUser = $env:WHYCODE_NEO4J_USER
$neo4jPassword = $env:WHYCODE_NEO4J_PASSWORD
$llmApiKey = $env:WHYCODE_LLM_API_KEY

if ([string]::IsNullOrWhiteSpace($neo4jUri) -or [string]::IsNullOrWhiteSpace($neo4jUser) -or [string]::IsNullOrWhiteSpace($neo4jPassword)) {
    Write-Host "ERROR: Neo4j credentials not configured."
    Write-Host "Please set WHYCODE_NEO4J_URI, WHYCODE_NEO4J_USER, and WHYCODE_NEO4J_PASSWORD in backend/.env"
    Write-Host ""
    Write-Host "Example in backend/.env:"
    Write-Host "  WHYCODE_NEO4J_URI=neo4j+s://xxxx.databases.neo4j.io"
    Write-Host "  WHYCODE_NEO4J_USER=neo4j"
    Write-Host "  WHYCODE_NEO4J_PASSWORD=your_password"
    Write-Host "  WHYCODE_LLM_API_KEY=your_llm_key"
    exit 1
}

$displayModel = if ($env:WHYCODE_LLM_MODEL) { $env:WHYCODE_LLM_MODEL } else { "gpt-4o-mini" }

Write-Host "Starting production backend on :$ApiPort ..."
Write-Host "  Neo4j: $neo4jUri"
Write-Host "  LLM Model: $displayModel"

$env:PYTHONPATH = "."
$backend = Start-Process -FilePath $venvPython -PassThru -NoNewWindow `
    -WorkingDirectory "backend" `
    -ArgumentList "-m", "uvicorn", "app.main:create_app", "--factory", "--port", "$ApiPort", "--reload"
Remove-Item Env:PYTHONPATH

try {
    $healthy = $false
    $lastError = ""
    foreach ($i in 1..30) {
        try {
            $req = [System.Net.WebRequest]::Create("http://127.0.0.1:$ApiPort/health")
            $req.Proxy = $null
            $req.Timeout = 2000
            $resp = $req.GetResponse()
            if ([int]$resp.StatusCode -eq 200) { $healthy = $true }
            $resp.Close()
            if ($healthy) { break }
        } catch { $lastError = $_.Exception.Message; Start-Sleep -Seconds 1 }
    }
    if (-not $healthy) { throw "Backend health check failed. Last error: $lastError" }
    Write-Host "Backend is healthy."

    # --- frontend ----------------------------------------------------------
    if (-not (Test-Path "frontend\node_modules")) {
        Write-Host "Installing frontend dependencies (first run)..."
        Push-Location frontend; npm install; Pop-Location
    }
    "NEXT_PUBLIC_API_MODE=http`r`nNEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:$ApiPort" |
        Set-Content -Encoding ascii "frontend\.env.local"
    Write-Host "Configured frontend/.env.local (API_MODE=http, BASE_URL=http://127.0.0.1:$ApiPort)."

    Write-Host "Starting frontend - open http://localhost:$WebPort"
    Push-Location frontend
    try { npm run dev } finally { Pop-Location }
} finally {
    if ($backend -and -not $backend.HasExited) { Stop-Process -Id $backend.Id -Force }
}
