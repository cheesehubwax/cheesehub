param([ValidateSet('Start', 'Stop')][string]$Action = 'Start')
$ErrorActionPreference = 'Stop'
$mutex = $null
$ownsMutex = $false
try {
    Set-Location -LiteralPath $PSScriptRoot
    $hash = [Security.Cryptography.SHA256]::Create()
    try { $folderId = [BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($PSScriptRoot.ToLowerInvariant()))).Replace('-', '') }
    finally { $hash.Dispose() }
    $mutex = New-Object Threading.Mutex($false, ('Local\CHEESECryptRunner-' + $folderId))
    try { $ownsMutex = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $ownsMutex = $true }
    if (!$ownsMutex) { throw 'A runner launcher is already active for this folder. Wait for it to finish.' }
    $configName = if (Test-Path -LiteralPath 'config.json') { 'config.json' } else { 'swarm-config.json' }
    if (!(Test-Path -LiteralPath $configName)) { throw 'Put your existing config.json or swarm-config.json in this folder first.' }
    $configPath = Join-Path $PSScriptRoot $configName
    $lockPath = $configPath + '.runner.lock'
    if ($Action -eq 'Stop') {
        if (!(Test-Path -LiteralPath $lockPath)) { Write-Host 'No launcher-managed runner is running.'; exit 0 }
        $lock = Get-Content -LiteralPath $lockPath -Raw | ConvertFrom-Json
        if (!$lock.token) { throw 'Invalid lock; inspect it manually. No process was killed.' }
        [IO.File]::WriteAllText($lockPath + '.stop', [string]$lock.token)
        Write-Host 'Stop requested. Waiting for any in-flight transaction; nothing will be retried.'
        $until = (Get-Date).AddSeconds(120)
        while ((Test-Path -LiteralPath $lockPath) -and (Get-Date) -lt $until) { Start-Sleep -Milliseconds 500 }
        if (Test-Path -LiteralPath $lockPath) { throw 'Still stopping or stale lock. Check swarm.log and swarm-error.log; no process was force-killed.' }
        Write-Host 'Runner stopped.'; exit 0
    }
    if (Test-Path -LiteralPath $lockPath) { throw 'A runner lock already exists. Use Stop first. After a PC reset, confirm no old runner remains before deleting only the .runner.lock file.' }
    $bun = (Get-Command bun -CommandType Application -ErrorAction Stop).Source
    foreach ($file in @('run.ts', 'runtime.ts', 'policy.ts', 'nightState.ts', 'runnerControl.ts')) {
        if (!(Test-Path -LiteralPath $file)) { throw "Missing $file. Extract all launcher update files into this folder." }
    }
    $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    $helper = [Uri]$config.broadcast
    if ($helper.Scheme -ne 'http' -or $helper.Host -notin @('localhost', '127.0.0.1') -or $helper.UserInfo) {
        throw 'This launcher requires a local Tor helper broadcast address; it will not start in direct mode.'
    }
    try { $null = Invoke-WebRequest -UseBasicParsing -Uri ($helper.AbsoluteUri.TrimEnd('/') + '/v2/health') -TimeoutSec 20 }
    catch { throw 'The local Tor helper health check failed. Start Tor and the helper, then click Start again.' }
    # Retain the previous logs once. Never put private keys in arguments or logs.
    foreach ($name in @('swarm.log', 'swarm-error.log')) {
        if (Test-Path -LiteralPath $name) { Move-Item -LiteralPath $name -Destination ($name + '.previous') -Force }
    }
    $process = Start-Process -FilePath $bun -ArgumentList @('run', 'run.ts', $configName) -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'swarm.log') -RedirectStandardError (Join-Path $PSScriptRoot 'swarm-error.log') -PassThru
    Start-Sleep -Seconds 2
    $process.Refresh()
    if ($process.HasExited) { throw 'Runner exited at startup. Open swarm-error.log and swarm.log; it was not restarted.' }
    Write-Host 'Runner launched in the background. Check swarm.log for permission checks and activity; Stop stops only this runner.'
    Write-Host 'This does not enable automatic startup after reboot. Start Tor/helper first, then double-click Start.'
} catch {
    # Do not print exceptions that might contain configuration contents/keys.
    if ($_.Exception.Message -match '^(Put your|Invalid lock|Still stopping|A runner lock|Missing |This launcher|The local Tor|Runner exited)') {
        Write-Host $_.Exception.Message
    } else { Write-Host 'Launcher failed. Check Bun installation, config JSON and folder access. Private configuration was not printed.' }
    exit 1
} finally {
    if ($ownsMutex) { $mutex.ReleaseMutex() }
    if ($mutex) { $mutex.Dispose() }
}