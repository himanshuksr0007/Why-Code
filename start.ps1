# Why-Code - start the demo backend and the frontend together.
#
#   .\start.ps1
# (If scripts are blocked: powershell -ExecutionPolicy Bypass -File .\start.ps1,
#  or just double-click start.bat, which does that for you.)
#
# Backend:  FastAPI demo app (offline fixture data, no Neo4j or API keys)
#           http://localhost:8000   (health check: /health)
# Frontend: Next.js at http://localhost:3000, wired to that backend.
#
# Ctrl+C stops both. The first run creates the Python venv and installs
# dependencies, so it takes a few minutes; later runs start in seconds.
# To run the production backend instead, swap create_demo_app for
# create_app below and provide the real environment (see backend/.env.example).
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

Write-Host "Starting backend on :$ApiPort ..."
$env:PYTHONPATH = "."
$backend = Start-Process -FilePath $venvPython -PassThru -NoNewWindow `
    -WorkingDirectory "backend" `
    -ArgumentList "-m", "uvicorn", "app.main:create_demo_app", "--factory", "--port", "$ApiPort"
Remove-Item Env:PYTHONPATH

try {
    $healthy = $false
    foreach ($i in 1..30) {
        try {
            $r = Invoke-WebRequest -UseBasicParsing "http://localhost:$ApiPort/health" -TimeoutSec 2
            if ($r.StatusCode -eq 200) { $healthy = $true; break }
        } catch { Start-Sleep -Seconds 1 }
    }
    if (-not $healthy) { throw "Backend did not come up - see the output above." }
    Write-Host "Backend is healthy."

    # --- frontend ----------------------------------------------------------
    if (-not (Test-Path "frontend\node_modules")) {
        Write-Host "Installing frontend dependencies (first run)..."
        Push-Location frontend; npm install; Pop-Location
    }
    if (-not (Test-Path "frontend\.env.local")) {
        "NEXT_PUBLIC_API_MODE=http`r`nNEXT_PUBLIC_API_BASE_URL=http://localhost:$ApiPort" |
            Set-Content -Encoding ascii "frontend\.env.local"
        Write-Host "Wrote frontend/.env.local (points the UI at the local backend)."
    }

    Write-Host "Starting frontend - open http://localhost:$WebPort"
    Push-Location frontend
    try { npm run dev } finally { Pop-Location }
} finally {
    if ($backend -and -not $backend.HasExited) { Stop-Process -Id $backend.Id -Force }
}
