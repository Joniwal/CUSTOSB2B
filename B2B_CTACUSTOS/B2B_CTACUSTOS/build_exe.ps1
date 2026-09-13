$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$venvPython = Join-Path $projectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $venvPython)) {
    py -m venv (Join-Path $projectRoot ".venv")
}

& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r (Join-Path $projectRoot "requirements.txt")
& $venvPython -m PyInstaller --clean --noconfirm (Join-Path $projectRoot "B2B_CTACUSTOS.spec")

$distData = Join-Path $projectRoot "dist\B2B_CTACUSTOS\data"
New-Item -ItemType Directory -Force -Path $distData | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot "data\B2B_CTACUSTOS.xlsx") -Destination $distData -Force
Copy-Item -LiteralPath (Join-Path $projectRoot ".env.example") -Destination (Join-Path $projectRoot "dist\B2B_CTACUSTOS\.env.example") -Force

Write-Host "Executável criado em: $(Join-Path $projectRoot 'dist\B2B_CTACUSTOS\B2B_CTACUSTOS.exe')"
