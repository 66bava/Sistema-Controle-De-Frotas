param([switch]$ComNavegador)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$mysqlBin = 'C:\Program Files\MySQL\MySQL Server 8.0\bin'
$backendPath = Split-Path -Parent $PSScriptRoot
$repoPath = Split-Path -Parent $backendPath
$validationDir = Join-Path ([System.IO.Path]::GetTempPath()) ('codex-frotas-auth-' + [guid]::NewGuid().ToString('N'))
$validationData = Join-Path $validationDir 'data'
New-Item -ItemType Directory -Path $validationData -ErrorAction Stop | Out-Null
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
$validationPort = $listener.LocalEndpoint.Port
$listener.Stop()
$initArgs = @('--no-defaults', '--initialize-insecure', ('--datadir="' + $validationData + '"'), '--console')
$initProcess = Start-Process -FilePath (Join-Path $mysqlBin 'mysqld.exe') -ArgumentList $initArgs -WindowStyle Hidden -Wait -PassThru -RedirectStandardError (Join-Path $validationDir 'initialize.log') -ErrorAction Stop
if ($initProcess.ExitCode -ne 0) { throw ('Falha na inicialização; consulte ' + $validationDir) }
$serverArgs = @('--no-defaults', ('--datadir="' + $validationData + '"'), '--bind-address=127.0.0.1', ('--port=' + $validationPort), '--mysqlx=0', '--skip-log-bin', '--console')
$validationServer = Start-Process -FilePath (Join-Path $mysqlBin 'mysqld.exe') -ArgumentList $serverArgs -WindowStyle Hidden -PassThru -RedirectStandardError (Join-Path $validationDir 'server.log') -ErrorAction Stop
$originalEnv = @{}
$envNames = @('DB_HOST','DB_PORT','DB_USER','DB_PASSWORD','DB_NAME','JWT_SECRET','MYSQL_INTEGRATION','BROWSER_TEST','FRONTEND_ORIGIN','NODE_ENV')
foreach ($envName in $envNames) { $originalEnv[$envName] = [Environment]::GetEnvironmentVariable($envName, 'Process') }
Push-Location $backendPath
try {
  $ready = $false
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    & (Join-Path $mysqlBin 'mysqladmin.exe') --no-defaults --host=127.0.0.1 --port=$validationPort --user=root ping --silent 2>$null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) { throw 'MySQL isolado não iniciou.' }
  $schema = [System.IO.File]::ReadAllText((Join-Path $repoPath 'sql/banco.sql')).Replace('controle_frotas','controle_frotas_test')
  $schema | & (Join-Path $mysqlBin 'mysql.exe') --no-defaults --host=127.0.0.1 --port=$validationPort --user=root --default-character-set=utf8mb4 > (Join-Path $validationDir 'schema.log')
  if ($LASTEXITCODE -ne 0) { throw 'Falha no schema isolado.' }
  $env:DB_HOST = '127.0.0.1'
  $env:DB_PORT = [string]$validationPort
  $env:DB_USER = 'root'
  $env:DB_PASSWORD = ''
  $env:DB_NAME = 'controle_frotas_test'
  $env:JWT_SECRET = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
  $env:MYSQL_INTEGRATION = '1'
  $env:BROWSER_TEST = if ($ComNavegador) { '1' } else { '0' }
  $env:NODE_ENV = 'test'
  & node --test tests/integration.test.js
  if ($LASTEXITCODE -ne 0) { throw 'Falha nos testes de integração.' }
} finally {
  & (Join-Path $mysqlBin 'mysqladmin.exe') --no-defaults --host=127.0.0.1 --port=$validationPort --user=root shutdown 2>$null
  if (-not $validationServer.WaitForExit(10000)) { Stop-Process -Id $validationServer.Id -ErrorAction SilentlyContinue }
  foreach ($envName in $envNames) { [Environment]::SetEnvironmentVariable($envName, $originalEnv[$envName], 'Process') }
  Pop-Location
  Write-Output ('Instância isolada encerrada. Logs: ' + $validationDir)
}
