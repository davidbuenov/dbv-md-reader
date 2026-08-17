# =============================================================================
# dbv-md-reader — Benchmark de rendimiento (arranque, RAM, CPU)
# Copyright (c) 2026 David Bueno Vallejo
# Licensed under the MIT License. See LICENSE for details.
# Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
# =============================================================================
# Metodologia: N repeticiones por medicion, se descartan el mejor y el peor
# resultado, se promedia el resto (mismo criterio que la Fase 1 del "Assessment
# Toolkit" de Microsoft para benchmarks de arranque). Requiere el ejecutable de
# RELEASE ya compilado (`npx tauri build --no-bundle` o `npm run build`) --
# un build de debug no es representativo del rendimiento real.
#
# Uso:
#   pwsh scripts/benchmark.ps1
#   pwsh scripts/benchmark.ps1 -Runs 10 -OutFile dbv-specs-ops/BENCHMARK_RESULTS.md
# =============================================================================
param(
  [int]$Runs = 7,
  [string]$ExePath = "$PSScriptRoot\..\src-tauri\target\release\dbv-md-reader.exe",
  [string]$SmallDoc = "$PSScriptRoot\..\test-doc.md",
  [string]$LargeDoc = "$PSScriptRoot\..\testfiles\GFM_test.md",
  [string]$OutFile = "$PSScriptRoot\..\dbv-specs-ops\BENCHMARK_RESULTS.md",
  [int]$SteadyStateWaitMs = 3000
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms

# ─── Utilidades ──────────────────────────────────────────────────────────────

function Get-ProcessTreeMemoryBytes {
  param([int]$RootPid)
  # Suma la memoria del proceso principal + cualquier hijo directo o indirecto
  # (WebView2 lanza procesos "Browser"/"Renderer"/"GPU"/etc. separados, como
  # Chromium -- contarlos aparte infravaloraria la huella real). Se miden dos
  # metricas por proceso:
  #   - WorkingSet64: memoria residente total, incluye paginas de codigo
  #     COMPARTIDAS entre procesos (el propio binario de msedgewebview2.exe,
  #     cargado una vez por Windows y reutilizado por cualquier app que use
  #     WebView2) -- es lo que muestra el Administrador de Tareas por defecto,
  #     pero sobreestima el coste EXCLUSIVO de esta app en concreto.
  #   - PrivateMemorySize64 ("Private Bytes"): memoria que solo esta instancia
  #     usa, sin las paginas compartidas -- la cifra justa de "cuanto anade
  #     especificamente abrir dbv-md-reader", pedida explicitamente por David
  #     tras revisar el primer borrador de este script (ver memory.md ADR-025).
  $all = Get-CimInstance Win32_Process
  $ids = [System.Collections.Generic.HashSet[uint32]]::new()
  $queue = New-Object System.Collections.Generic.Queue[uint32]
  $queue.Enqueue([uint32]$RootPid)
  while ($queue.Count -gt 0) {
    $pid_ = $queue.Dequeue()
    if (-not $ids.Add($pid_)) { continue }
    foreach ($child in ($all | Where-Object { $_.ParentProcessId -eq $pid_ })) {
      $queue.Enqueue([uint32]$child.ProcessId)
    }
  }
  $totalWs = 0L; $mainWs = 0L
  $totalPriv = 0L; $mainPriv = 0L
  foreach ($p in $ids) {
    $proc = Get-Process -Id $p -ErrorAction SilentlyContinue
    if ($proc) {
      $totalWs += $proc.WorkingSet64
      $totalPriv += $proc.PrivateMemorySize64
      if ($p -eq $RootPid) { $mainWs = $proc.WorkingSet64; $mainPriv = $proc.PrivateMemorySize64 }
    }
  }
  return @{
    TotalWorkingSet = $totalWs; MainWorkingSet = $mainWs
    TotalPrivate = $totalPriv; MainPrivate = $mainPriv
    ProcessCount = $ids.Count
  }
}

function Stop-AllInstances {
  # Mata tambien los procesos auxiliares de WebView2 de esta app (identificados
  # por su --user-data-dir, que incluye el identifier de tauri.conf.json) -- si
  # no, pueden quedar restos "muriendose" que contaminan la siguiente medicion
  # (WebView2 es multi-proceso: Browser/GPU/utility/crashpad-handler/renderer).
  Get-Process -Name "dbv-md-reader" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" |
    Where-Object { $_.CommandLine -like "*com.davidbuenov.dbv-md-reader*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  while ($sw.ElapsedMilliseconds -lt 5000) {
    $leftover = @(Get-Process -Name "dbv-md-reader" -ErrorAction SilentlyContinue) +
                @(Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" |
                  Where-Object { $_.CommandLine -like "*com.davidbuenov.dbv-md-reader*" })
    if ($leftover.Count -eq 0) { break }
    Start-Sleep -Milliseconds 150
  }
  Start-Sleep -Milliseconds 250
}

function Wait-ForWindowReady {
  param([int]$ProcId, [int]$TimeoutMs = 15000)
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  while ($sw.ElapsedMilliseconds -lt $TimeoutMs) {
    $proc = Get-Process -Id $ProcId -ErrorAction SilentlyContinue
    if ($proc -and $proc.MainWindowHandle -ne 0) {
      return $sw.ElapsedMilliseconds
    }
    Start-Sleep -Milliseconds 25
  }
  return -1
}

function Get-TrimmedAverage {
  param([double[]]$Values)
  if ($Values.Count -le 2) { return ($Values | Measure-Object -Average).Average }
  $sorted = $Values | Sort-Object
  $trimmed = $sorted[1..($sorted.Count - 2)]
  return ($trimmed | Measure-Object -Average).Average
}

function Start-MeasuredInstance {
  # Patron comun a las tres funciones Measure-*: matar cualquier instancia
  # previa, lanzar una nueva y esperar a que tenga ventana. Devuelve el
  # proceso y los ms transcurridos (-1 si hizo timeout) para que cada llamador
  # decida que hacer con ellos (medir arranque, o solo tener el PID listo).
  param([string[]]$Args_)
  Stop-AllInstances
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $p = Start-Process -FilePath $ExePath -ArgumentList $Args_ -PassThru
  $elapsed = Wait-ForWindowReady -ProcId $p.Id
  $sw.Stop()
  return @{ Process = $p; ElapsedMs = $elapsed }
}

function Measure-StartupTime {
  param([string]$Label, [string[]]$Args_, [int]$Count)
  $times = @()
  for ($i = 0; $i -lt $Count; $i++) {
    $inst = Start-MeasuredInstance -Args_ $Args_
    if ($inst.ElapsedMs -ge 0) {
      $times += $inst.ElapsedMs
      Write-Host "  [$Label] run $($i+1)/$Count : $($inst.ElapsedMs) ms"
    } else {
      Write-Warning "  [$Label] run $($i+1)/$Count : timeout, descartado"
    }
    Start-Sleep -Milliseconds 300
  }
  Stop-AllInstances
  return $times
}

function Measure-SteadyStateMemory {
  param([string]$Label, [string[]]$Args_, [int]$Count, [int]$ExtraWindows = 0)
  $totalWs = @(); $mainWs = @()
  $totalPriv = @(); $mainPriv = @()
  $procCounts = @()
  for ($i = 0; $i -lt $Count; $i++) {
    $p = (Start-MeasuredInstance -Args_ $Args_).Process
    for ($w = 0; $w -lt $ExtraWindows; $w++) {
      Start-Process -FilePath $ExePath -ArgumentList $Args_ | Out-Null
      Start-Sleep -Milliseconds 800
    }
    Start-Sleep -Milliseconds $SteadyStateWaitMs
    $mem = Get-ProcessTreeMemoryBytes -RootPid $p.Id
    $totalWs += ($mem.TotalWorkingSet / 1MB)
    $mainWs += ($mem.MainWorkingSet / 1MB)
    $totalPriv += ($mem.TotalPrivate / 1MB)
    $mainPriv += ($mem.MainPrivate / 1MB)
    $procCounts += $mem.ProcessCount
    Write-Host ("  [$Label] run {0}/{1} : WorkingSet total {2:N1} MB / privada {3:N1} MB (proceso principal: {4:N1} MB total, {5:N1} MB privada; {6} procesos)" -f ($i+1), $Count, ($mem.TotalWorkingSet/1MB), ($mem.TotalPrivate/1MB), ($mem.MainWorkingSet/1MB), ($mem.MainPrivate/1MB), $mem.ProcessCount)
  }
  Stop-AllInstances
  return @{
    TotalWsMB = Get-TrimmedAverage -Values $totalWs
    MainWsMB = Get-TrimmedAverage -Values $mainWs
    TotalPrivMB = Get-TrimmedAverage -Values $totalPriv
    MainPrivMB = Get-TrimmedAverage -Values $mainPriv
    ProcessCount = [math]::Round(($procCounts | Measure-Object -Average).Average, 1)
  }
}

function Measure-CpuPercent {
  param([string]$Label, [string[]]$Args_, [int]$SampleDurationMs, [int]$DelayBeforeSampleMs)
  $p = (Start-MeasuredInstance -Args_ $Args_).Process
  if ($DelayBeforeSampleMs -gt 0) { Start-Sleep -Milliseconds $DelayBeforeSampleMs }
  $cpuBefore = (Get-Process -Id $p.Id -ErrorAction SilentlyContinue).TotalProcessorTime
  Start-Sleep -Milliseconds $SampleDurationMs
  $proc = Get-Process -Id $p.Id -ErrorAction SilentlyContinue
  if (-not $proc) { Stop-AllInstances; return $null }
  $cpuAfter = $proc.TotalProcessorTime
  Stop-AllInstances
  $cpuMs = ($cpuAfter - $cpuBefore).TotalMilliseconds
  $cores = [Environment]::ProcessorCount
  $pct = ($cpuMs / $SampleDurationMs / $cores) * 100
  return [math]::Round($pct, 1)
}

# ─── Datos del equipo (para que el resultado sea comparable/reproducible) ────

function Get-EnvironmentInfo {
  $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
  $os = Get-CimInstance Win32_OperatingSystem
  $ramTotalGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
  $gpu = (Get-CimInstance Win32_VideoController | Select-Object -First 1).Name
  $battery = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue
  $onBattery = $false
  if ($battery) { $onBattery = $battery.BatteryStatus -ne 2 }
  $exeInfo = Get-Item $ExePath
  $exeSizeMB = [math]::Round($exeInfo.Length / 1MB, 2)

  return [ordered]@{
    "Fecha"              = (Get-Date -Format "yyyy-MM-dd HH:mm")
    "CPU"                = $cpu.Name.Trim()
    "Núcleos / hilos"    = "$($cpu.NumberOfCores) núcleos / $($cpu.NumberOfLogicalProcessors) hilos"
    "RAM total"          = "$ramTotalGB GB"
    "GPU"                = $gpu
    "SO"                 = "$($os.Caption) (build $($os.BuildNumber))"
    "Alimentación"       = if ($onBattery) { "⚠️ BATERÍA (resultados menos fiables — conecta a corriente y repite)" } else { "Corriente alterna" }
    "Ejecutable probado" = "$($exeInfo.Name) ($exeSizeMB MB, compilado $($exeInfo.LastWriteTime.ToString('yyyy-MM-dd HH:mm')))"
  }
}

# ─── Ejecución ────────────────────────────────────────────────────────────────

if (-not (Test-Path $ExePath)) {
  Write-Error "No existe el ejecutable de release en '$ExePath'. Compila primero con: npx tauri build --no-bundle"
  exit 1
}

Write-Host "=== dbv-md-reader — Benchmark ($Runs repeticiones por medición) ===" -ForegroundColor Cyan
$env_ = Get-EnvironmentInfo
$env_.GetEnumerator() | ForEach-Object { Write-Host ("  {0}: {1}" -f $_.Key, $_.Value) }
Write-Host ""

Write-Host "-- Arranque en frío (proceso nuevo cada vez) --" -ForegroundColor Yellow
$cold = Measure-StartupTime -Label "frío" -Args_ @($SmallDoc) -Count $Runs

Write-Host "-- Arranque en caliente (inmediatamente después del anterior) --" -ForegroundColor Yellow
$warm = Measure-StartupTime -Label "caliente" -Args_ @($SmallDoc) -Count $Runs

Write-Host "-- RAM en reposo: Estado vacío (sin documento) --" -ForegroundColor Yellow
$ramEmpty = Measure-SteadyStateMemory -Label "vacío" -Args_ @() -Count $Runs

Write-Host "-- RAM en reposo: documento pequeño ($([System.IO.Path]::GetFileName($SmallDoc))) --" -ForegroundColor Yellow
$ramSmall = Measure-SteadyStateMemory -Label "pequeño" -Args_ @($SmallDoc) -Count $Runs

Write-Host "-- RAM en reposo: documento grande ($([System.IO.Path]::GetFileName($LargeDoc))) --" -ForegroundColor Yellow
$ramLarge = Measure-SteadyStateMemory -Label "grande" -Args_ @($LargeDoc) -Count $Runs

Write-Host "-- RAM con 3 ventanas abiertas simultáneas --" -ForegroundColor Yellow
$ramMultiWindow = Measure-SteadyStateMemory -Label "multi-ventana" -Args_ @($SmallDoc) -Count $Runs -ExtraWindows 2

Write-Host "-- CPU en reposo (documento pequeño, tras estabilizar) --" -ForegroundColor Yellow
$cpuIdle = Measure-CpuPercent -Label "reposo" -Args_ @($SmallDoc) -SampleDurationMs 2000 -DelayBeforeSampleMs $SteadyStateWaitMs

Write-Host "-- CPU durante el renderizado inicial (documento grande, muestra tomada nada más arrancar) --" -ForegroundColor Yellow
$cpuRender = Measure-CpuPercent -Label "render" -Args_ @($LargeDoc) -SampleDurationMs 500 -DelayBeforeSampleMs 0

# ─── Informe ──────────────────────────────────────────────────────────────────

$coldAvg = Get-TrimmedAverage -Values $cold
$warmAvg = Get-TrimmedAverage -Values $warm

$report = New-Object System.Text.StringBuilder
[void]$report.AppendLine("# Resultados de Benchmark — dbv-md-reader")
[void]$report.AppendLine("")
[void]$report.AppendLine("> Generado automáticamente por ``scripts/benchmark.ps1``. Metodología: $Runs repeticiones por medición, se descarta la mejor y la peor, se promedia el resto. Repetible por cualquiera — ejecuta el script en tu propia máquina para comparar.")
[void]$report.AppendLine("")
[void]$report.AppendLine("## Equipo de referencia")
[void]$report.AppendLine("")
[void]$report.AppendLine("| Campo | Valor |")
[void]$report.AppendLine("|---|---|")
foreach ($kv in $env_.GetEnumerator()) {
  [void]$report.AppendLine("| $($kv.Key) | $($kv.Value) |")
}
[void]$report.AppendLine("")
[void]$report.AppendLine("## Arranque")
[void]$report.AppendLine("")
[void]$report.AppendLine("| Medición | Resultado |")
[void]$report.AppendLine("|---|---|")
[void]$report.AppendLine(("| Arranque en frío (documento pequeño) | {0:N0} ms |" -f $coldAvg))
[void]$report.AppendLine(("| Arranque en caliente (documento pequeño) | {0:N0} ms |" -f $warmAvg))
[void]$report.AppendLine("")
[void]$report.AppendLine("*`"Frío`"/`"caliente`" aproximan si la caché de disco del SO ya tenía el ejecutable — no es un reinicio real de Windows entre medición y medición (impracticable de automatizar). `"Listo`" se mide como el instante en que el proceso obtiene un ``MainWindowHandle`` visible, no cuando el documento ha terminado de renderizarse del todo.*")
[void]$report.AppendLine("")
[void]$report.AppendLine("## Memoria (RAM)")
[void]$report.AppendLine("")

$scenarios = @(
  @{ Label = "Estado vacío (sin documento)"; Data = $ramEmpty }
  @{ Label = "Documento pequeño (~40 líneas)"; Data = $ramSmall }
  @{ Label = "Documento grande (~980 líneas)"; Data = $ramLarge }
  @{ Label = "3 ventanas simultáneas (doc. pequeño)"; Data = $ramMultiWindow }
)

[void]$report.AppendLine("### Proceso principal (`dbv-md-reader.exe` en solitario)")
[void]$report.AppendLine("")
[void]$report.AppendLine("| Escenario | Working Set | Memoria privada |")
[void]$report.AppendLine("|---|---|---|")
foreach ($s in $scenarios) {
  [void]$report.AppendLine(("| {0} | {1:N1} MB | {2:N1} MB |" -f $s.Label, $s.Data.MainWsMB, $s.Data.MainPrivMB))
}
[void]$report.AppendLine("")
[void]$report.AppendLine("### Árbol completo (incluye los procesos que WebView2 lanza para esta app: motor de renderizado, GPU, red, almacenamiento...)")
[void]$report.AppendLine("")
[void]$report.AppendLine("| Escenario | Working Set total | Memoria privada total | Nº procesos |")
[void]$report.AppendLine("|---|---|---|---|")
foreach ($s in $scenarios) {
  [void]$report.AppendLine(("| {0} | {1:N1} MB | {2:N1} MB | {3} |" -f $s.Label, $s.Data.TotalWsMB, $s.Data.TotalPrivMB, $s.Data.ProcessCount))
}
[void]$report.AppendLine("")
[void]$report.AppendLine('*Estos procesos de WebView2 los lanza esta app (aparecen como hijos de `dbv-md-reader.exe` y mueren con ella) — no son un runtime ajeno que se pueda descontar. Pero el `Working Set` cuenta como propias unas páginas de código que Windows en realidad comparte físicamente entre cualquier proceso que use WebView2 (a diferencia de Electron, que no comparte nada entre apps) — por eso se reporta también la `Memoria privada`, que excluye esas páginas compartidas y refleja mejor el coste exclusivo real de esta app.*')
[void]$report.AppendLine("")
[void]$report.AppendLine("## CPU")
[void]$report.AppendLine("")
[void]$report.AppendLine("| Escenario | % CPU (promedio, todos los núcleos) |")
[void]$report.AppendLine("|---|---|")
[void]$report.AppendLine(("| En reposo (tras estabilizar) | {0} % |" -f $cpuIdle))
[void]$report.AppendLine(("| Renderizado inicial (documento grande, primeros 500 ms) | {0} % |" -f $cpuRender))
[void]$report.AppendLine("")

$report.ToString() | Out-File -FilePath $OutFile -Encoding utf8
Write-Host ""
Write-Host "Informe guardado en: $OutFile" -ForegroundColor Green
