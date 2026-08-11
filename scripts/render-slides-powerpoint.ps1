param(
  [Parameter(Mandatory = $true)][string]$PptxPath,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [int]$Width = 1920,
  [int]$Height = 1080,
  [int]$StartIndex = 1
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $PptxPath)) {
  throw "PPTX not found: $PptxPath"
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# Microsoft PowerPoint and WPS Presentation both expose a COM Presentations API.
# Prefer WPS first when both exist (common on VN developer machines).
$progIds = @(
  "KWPP.Application",
  "Kwpp.Application",
  "KWPP.Application.12",
  "KWPP.Application.9",
  "PowerPoint.Application",
  "PowerPoint.Application.16",
  "PowerPoint.Application.15"
)

function New-PresentationApp {
  param([string[]]$Candidates)
  $lastError = $null
  foreach ($id in $Candidates) {
    try {
      $app = New-Object -ComObject $id
      Write-Host ("ENGINE:{0}" -f $id)
      return ,$app
    } catch {
      $lastError = $_
      Write-Host ("TRY_FAIL:{0}:{1}" -f $id, $_.Exception.Message)
    }
  }
  throw ("Khong tao duoc COM PPT/WPS. Cai Microsoft PowerPoint hoac WPS Office (Presentation) va thu lai. Chi tiet: {0}" -f $lastError.Exception.Message)
}

function Open-PresentationFile {
  param($App, [string]$Path)
  # Signature varies slightly between MS PPT and WPS; try common overload shapes.
  try {
    return $App.Presentations.Open($Path, $false, $false, $false)
  } catch {}
  try {
    return $App.Presentations.Open($Path, $false, $false)
  } catch {}
  return $App.Presentations.Open($Path)
}

function Export-SlidePng {
  param($Slide, [string]$OutFile, [int]$W, [int]$H)
  try {
    $Slide.Export($OutFile, "PNG", $W, $H)
    return $true
  } catch {
    try {
      $Slide.Export($OutFile, "PNG")
      return $true
    } catch {
      return $false
    }
  }
}

function Export-AllViaSaveAs {
  param($Presentation, [string]$Dir)
  # WPS/PPT SaveAs type 17 = PNG sequence (Slide1.PNG ...) into folder or path prefix.
  $tmpPrefix = Join-Path $Dir "_export_slide"
  try {
    $Presentation.SaveAs($tmpPrefix, 17)
  } catch {
    throw ("SaveAs PNG that bai: {0}" -f $_.Exception.Message)
  }

  $produced = Get-ChildItem -LiteralPath $Dir -File | Where-Object {
    $_.Name -match '(?i)^(slide|(_export_slide))(\s*)(\d+)\.(png|jpg|jpeg)$' -or
    $_.Name -match '(?i)^_export_slide(\d+)\.(png|jpg|jpeg)$' -or
    $_.Name -match '(?i)^Slide(\d+)\.(png|jpg|jpeg)$'
  }

  if (-not $produced -or $produced.Count -eq 0) {
    # Some builds write next to the prefix without numbering in predictable names.
    $produced = Get-ChildItem -LiteralPath $Dir -File | Where-Object {
      $_.Extension -match '(?i)\.(png|jpg|jpeg)$' -and $_.Name -like '_export_slide*'
    }
  }

  $mapped = 0
  foreach ($file in ($produced | Sort-Object Name)) {
    if ($file.Name -match '(\d+)\.(png|jpg|jpeg)$') {
      $idx = [int]$Matches[1]
    } else {
      continue
    }
    $target = Join-Path $Dir ("slide-{0}.png" -f $idx)
    if ($file.FullName -ne $target) {
      if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Force }
      if ($file.Extension -match '(?i)\.png$') {
        Move-Item -LiteralPath $file.FullName -Destination $target -Force
      } else {
        # Keep non-PNG as-is named .png only if already png; otherwise copy bytes (JPG fallback).
        Copy-Item -LiteralPath $file.FullName -Destination $target -Force
        Remove-Item -LiteralPath $file.FullName -Force -ErrorAction SilentlyContinue
      }
    }
    $mapped += 1
    Write-Host ("EXPORTED:{0}" -f $idx)
  }

  Get-ChildItem -LiteralPath $Dir -File -Filter '_export_slide*' -ErrorAction SilentlyContinue |
    Remove-Item -Force -ErrorAction SilentlyContinue

  return $mapped
}

$ppt = $null
$presentation = $null

try {
  $ppt = New-PresentationApp -Candidates $progIds

  try { $ppt.Visible = -1 } catch {
    try { $ppt.Visible = 1 } catch {}
  }
  try { $ppt.DisplayAlerts = 1 } catch {}

  $presentation = Open-PresentationFile -App $ppt -Path $PptxPath
  $count = [int]$presentation.Slides.Count
  Write-Output ("TOTAL:{0}" -f $count)

  $exported = 0
  for ($i = [Math]::Max(1, $StartIndex); $i -le $count; $i++) {
    $outFile = Join-Path $OutDir ("slide-{0}.png" -f $i)
    if (Test-Path -LiteralPath $outFile) {
      $len = (Get-Item -LiteralPath $outFile).Length
      if ($len -gt 1024) {
        Write-Output ("SKIP:{0}" -f $i)
        $exported += 1
        continue
      }
    }

    $slide = $presentation.Slides.Item($i)
    if (Export-SlidePng -Slide $slide -OutFile $outFile -W $Width -H $Height) {
      Write-Output ("EXPORTED:{0}" -f $i)
      $exported += 1
    } else {
      Write-Output ("EXPORT_FAIL:{0}" -f $i)
    }
  }

  if ($exported -lt $count) {
    Write-Output "FALLBACK:SaveAs"
    [void](Export-AllViaSaveAs -Presentation $presentation -Dir $OutDir)
  }

  Write-Output ("DONE:{0}" -f $count)
}
finally {
  if ($null -ne $presentation) {
    try { $presentation.Close() } catch {}
    try { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($presentation) } catch {}
  }
  if ($null -ne $ppt) {
    try { $ppt.Quit() } catch {}
    try { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) } catch {}
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
