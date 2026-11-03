param([switch]$InstallOnly)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$pilotNode = Get-Command node -ErrorAction SilentlyContinue
if (-not $pilotNode) { throw 'Install Node.js 24 LTS, reopen the terminal, then run this script again.' }
$pilotNpmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
$pilotNpmCli = Join-Path (Split-Path -Parent $pilotNode.Source) 'node_modules/npm/bin/npm-cli.js'
$pilotWorkspaceNpm = Join-Path $PSScriptRoot '../../work/npm/package/bin/npm-cli.js'
function Invoke-PilotNpm {
  param([string[]]$NpmArgs)
  if ($pilotNpmCommand) { & $pilotNpmCommand.Source @NpmArgs }
  elseif (Test-Path -LiteralPath $pilotNpmCli) { & $pilotNode.Source $pilotNpmCli @NpmArgs }
  elseif (Test-Path -LiteralPath $pilotWorkspaceNpm) { & $pilotNode.Source $pilotWorkspaceNpm @NpmArgs }
  else { throw 'npm was not found. Install the official Node.js 24 LTS distribution with npm.' }
  if ($LASTEXITCODE -ne 0) { throw "npm failed with exit code $LASTEXITCODE" }
}
if (-not (Test-Path -LiteralPath 'node_modules/vite/bin/vite.js')) { Invoke-PilotNpm -NpmArgs @('ci') }
if (-not $InstallOnly) { Invoke-PilotNpm -NpmArgs @('run','dev') }
