<#
Rebuilds data/ppi.js from the Official Log.

Usage:
  1. In the Official Calculation Log workbook, open the "Official Log" tab.
  2. File > Download > Comma-separated values (.csv).
  3. powershell -ExecutionPolicy Bypass -File tools\update-data.ps1 -Source "C:\path\to\Official Log.csv"

Several sources may be passed (comma-separated); later files win on a duplicate run key.
A Sheets API values snapshot (.json with a "values" array) is also accepted.

Columns are read by position, A through AN:
  A run key | B city PPI | C movement | D market status | E primary driver
  F-M  team score and weight pairs, in Eagles / Phillies / Sixers / Flyers order
  N-AK 24 component scores, same team order, six per team
  AL research summary | AM calculation notes | AN methodology version

Only the run key, numbers, status, driver and version are published. Research
summaries and calculation notes stay in the workbook. Rows marked VERIFYING or
BLOCKED are skipped; nothing is carried forward or filled in.
#>
param(
  [Parameter(Mandatory = $true)][string[]]$Source,
  # Where the data file goes. Default: data/ppi.js in the site.
  [string]$Out,
  # By default the script refuses to publish fewer readings than are already live,
  # so a half-loaded feed can never erase history. Pass this after a deliberate removal.
  [switch]$AllowShrink,
  # The homepage. The latest official print is written into its link-preview tags and
  # its static text, for anything that reads the page without running JavaScript.
  [string]$Page,
  # The RSS feed: the latest official prints plus the research notes. Default: feed.xml in the site.
  [string]$Feed
)

$ErrorActionPreference = 'Stop'
$inv = [Globalization.CultureInfo]::InvariantCulture

# The defaults are worked out here, not in the parameter list: Windows PowerShell 5.1 has
# no script folder yet at that point when the script is started with -File.
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $Out) { $Out = Join-Path (Join-Path $root 'data') 'ppi.js' }
if (-not $Page) { $Page = Join-Path $root 'index.html' }
if (-not $Feed) { $Feed = Join-Path $root 'feed.xml' }

function ConvertTo-Number([string]$s) {
  $t = ($s -replace '[%,\s+]', '') -replace [char]0x2212, '-'
  $n = 0.0
  if ([double]::TryParse($t, [Globalization.NumberStyles]::Float, $inv, [ref]$n)) { return $n }
  return $null
}

$rows = @()
foreach ($path in $Source) {
  if ($path -match '\.json$') {
    $j = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($v in $j.values) { $rows += , @($v) }
  } elseif ($path -match '\.txt$') {
    # Pipe snapshot: run key|city|move|status|driver|32 numbers|research status|version
    foreach ($line in [IO.File]::ReadAllLines((Resolve-Path -LiteralPath $path), [Text.Encoding]::UTF8)) {
      if (-not $line) { continue }
      $p = $line.Split('|')
      $rows += , @(@("$($p[0]) ET", $p[1], $p[2], $p[3], $p[4]) + $p[5].Split(',') + @('', "Research status: $($p[6])", $p[7]))
    }
  } else {
    $headers = 0..39 | ForEach-Object { "c$_" }
    foreach ($r in (Import-Csv -LiteralPath $path -Header $headers -Encoding UTF8)) {
      $rows += , @($headers | ForEach-Object { [string]$r.$_ })
    }
  }
}

$teams = 'eagles', 'phillies', 'sixers', 'flyers'
$byKey = @{}
$skipped = @()
$noComps = @()

foreach ($v in $rows) {
  $key = ([string]$v[0]).Trim()
  if ($key -notmatch '^(\d{4}-\d{2}-\d{2}) \d{2}:\d{2} ET$') { continue }
  $date = $Matches[1]
  if ($v.Count -lt 40) { $skipped += "$key (incomplete row: $($v.Count) of 40 columns)"; continue }
  if ([string]$v[38] -match 'Research status:\s*(VERIFYING|BLOCKED)') { $skipped += "$key ($($Matches[1]))"; continue }

  $nums = 1, 2 + 5..12 | ForEach-Object { ConvertTo-Number ([string]$v[$_]) }
  if ($nums -contains $null) { $skipped += "$key (missing or non-numeric score or weight)"; continue }

  # Component scores may be absent on early rows; they are published as null, never filled in.
  $comps = 13..36 | ForEach-Object { ConvertTo-Number ([string]$v[$_]) }
  $hasComps = -not ($comps -contains $null)
  if (-not $hasComps) { $noComps += $key }

  $t = [ordered]@{}
  for ($i = 0; $i -lt 4; $i++) {
    $c = $null
    if ($hasComps) { $c = @(0..5 | ForEach-Object { ConvertTo-Number $v[13 + 6 * $i + $_] }) }
    $t[$teams[$i]] = [ordered]@{
      score  = ConvertTo-Number $v[5 + 2 * $i]
      weight = ConvertTo-Number $v[6 + 2 * $i]
      c      = $c
    }
  }
  $byKey[$key] = [ordered]@{
    run     = $key
    date    = $date
    city    = ConvertTo-Number $v[1]
    move    = ConvertTo-Number $v[2]
    status  = ([string]$v[3]).Trim()
    driver  = ([string]$v[4]).Trim()
    teams   = $t
    version = ([string]$v[39]).Trim()
  }
}

if ($byKey.Count -eq 0) { throw 'No official rows found. Nothing written.' }

$lines = $byKey.Keys | Sort-Object | ForEach-Object { '    ' + ($byKey[$_] | ConvertTo-Json -Depth 6 -Compress) }
$stamp = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
$js = "// Generated by tools/update-data.ps1 from the Official Log. Do not edit by hand.`nwindow.PPI_DATA = {`n  generated: `"$stamp`",`n  readings: [`n" + ($lines -join ",`n") + "`n  ]`n};`n"

$outFull = [IO.Path]::GetFullPath($Out)
$keys = @($byKey.Keys | Sort-Object)

# The homepage is left alone when the data is written somewhere other than the site (a test run).
$skipPage = $PSBoundParameters.ContainsKey('Out') -and -not $PSBoundParameters.ContainsKey('Page')

function Update-Page {
  if ($skipPage -or -not (Test-Path -LiteralPath $Page)) { return }
  $enc = New-Object Text.UTF8Encoding($false)
  $html = [IO.File]::ReadAllText($Page, $enc)
  $nl = "`n"; if ($html.Contains("`r`n")) { $nl = "`r`n" }
  $h = { param([string]$s) $s.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;').Replace('"', '&quot;') }

  $last = $byKey[$keys[-1]]
  $city = ([double]$last.city).ToString('0.0', $inv)
  $mv = [double]$last.move
  $moveText = 'unchanged from the prior print'
  if ($mv -gt 0.04) { $moveText = "up $($mv.ToString('0.0', $inv)) from the prior print" }
  if ($mv -lt -0.04) { $moveText = "down $((-$mv).ToString('0.0', $inv)) from the prior print" }
  $dateText = [datetime]::ParseExact($last.date, 'yyyy-MM-dd', $inv).ToString('MMM d, yyyy', $inv).ToUpper()
  $driver = $last.driver
  $short = $driver
  if ($short.Length -gt 180) { $short = $short.Substring(0, 177).TrimEnd() + '...' }
  $title = "Philly Panic Index: $city, $($last.status)"
  $desc = "Official print $dateText`: $city, $moveText. $short"

  # Only the search description carries the reading. The link-preview card (og: tags) stays
  # evergreen, because social sites cache it at the moment a link is posted.
  $meta = "<meta name=`"description`" content=`"$(& $h $desc)`">"
  $new = [regex]::Replace($html, '(?s)(<!-- ppi:meta[^>]*-->).*?(<!-- /ppi:meta -->)', { param($m) $m.Groups[1].Value + $nl + $meta + $nl + $m.Groups[2].Value })
  foreach ($pair in @(@('city', $city), @('mast-date', $dateText), @('driver', (& $h $driver)))) {
    $value = $pair[1]
    $new = [regex]::Replace($new, "(<[^>]*\bid=`"$($pair[0])`"[^>]*>)[^<]*", { param($m) $m.Groups[1].Value + $value })
  }
  if ($new -ne $html) {
    [IO.File]::WriteAllText($Page, $new, $enc)
    "Homepage stamped with the $dateText print ($city, $($last.status))"
  }
}
Update-Page

# feed.xml: the 30 latest official prints and every research note, newest first. Readers and
# feed services poll it, so it is rewritten only when its contents change. Like the homepage,
# it is left alone on a test run that writes the data somewhere else.
$skipFeed = $PSBoundParameters.ContainsKey('Out') -and -not $PSBoundParameters.ContainsKey('Feed')
if (-not $skipFeed) {
  $x = { param([string]$s) $s.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;') }
  $site = 'https://phillypanic.com/'
  try { $tz = [TimeZoneInfo]::FindSystemTimeZoneById('America/New_York') }
  catch { $tz = [TimeZoneInfo]::FindSystemTimeZoneById('Eastern Standard Time') }
  $toUtc = { param([datetime]$d) [TimeZoneInfo]::ConvertTimeToUtc([datetime]::SpecifyKind($d, 'Unspecified'), $tz) }
  $items = @()

  foreach ($k in ($keys | Select-Object -Last 30)) {
    $r = $byKey[$k]
    $mv = [double]$r.move
    $moveText = 'unchanged'
    if ($mv -gt 0.04) { $moveText = "up $($mv.ToString('0.0', $inv))" }
    if ($mv -lt -0.04) { $moveText = "down $((-$mv).ToString('0.0', $inv))" }
    $dateText = [datetime]::ParseExact($r.date, 'yyyy-MM-dd', $inv).ToString('MMM d', $inv)
    $items += [pscustomobject]@{
      when  = & $toUtc ([datetime]::ParseExact($k.Substring(0, 16), 'yyyy-MM-dd HH:mm', $inv))
      title = "PPI $(([double]$r.city).ToString('0.0', $inv)), $moveText. $($r.status). $dateText official print"
      link  = $site
      guid  = "ppi:$k"
      perma = 'false'
      desc  = $r.driver
    }
  }

  $research = Join-Path $root 'research'
  if (Test-Path -LiteralPath $research) {
    foreach ($f in (Get-ChildItem -LiteralPath $research -Filter '*.html' | Where-Object { $_.Name -notmatch '^_' } | Sort-Object Name)) {
      $t = [IO.File]::ReadAllText($f.FullName, [Text.Encoding]::UTF8)
      $get = { param($p) $m = [regex]::Match($t, $p); if ($m.Success) { [Net.WebUtility]::HtmlDecode($m.Groups[1].Value) } }
      $title = & $get '<meta property="og:title" content="([^"]*)"'
      $url = & $get '<link rel="canonical" href="([^"]*)"'
      $date = & $get '<meta property="article:published_time" content="(\d{4}-\d{2}-\d{2})'
      if (-not ($title -and $url -and $date)) { continue }
      $items += [pscustomobject]@{
        # Notes carry a date but no time; noon Eastern keeps them on the right day everywhere.
        when  = & $toUtc ([datetime]::ParseExact($date, 'yyyy-MM-dd', $inv).AddHours(12))
        title = "Research: $title"
        link  = $url
        guid  = $url
        perma = 'true'
        desc  = & $get '<meta name="description" content="([^"]*)"'
      }
    }
  }

  $items = @($items | Sort-Object when -Descending)
  $rfc = { param($d) $d.ToString('ddd, dd MMM yyyy HH:mm:ss', $inv) + ' GMT' }
  $xml = "<?xml version=`"1.0`" encoding=`"UTF-8`"?>`n<rss version=`"2.0`" xmlns:atom=`"http://www.w3.org/2005/Atom`">`n<channel>`n" +
    "  <title>Philly Panic Index</title>`n  <link>$site</link>`n" +
    "  <description>A daily index of panic surrounding the Eagles, Phillies, Sixers and Flyers. Official prints and research notes.</description>`n" +
    "  <language>en-us</language>`n  <atom:link href=`"${site}feed.xml`" rel=`"self`" type=`"application/rss+xml`"/>`n" +
    "  <lastBuildDate>$(& $rfc $items[0].when)</lastBuildDate>`n"
  foreach ($i in $items) {
    $xml += "  <item>`n    <title>$(& $x $i.title)</title>`n    <link>$($i.link)</link>`n    <guid isPermaLink=`"$($i.perma)`">$(& $x $i.guid)</guid>`n" +
      "    <pubDate>$(& $rfc $i.when)</pubDate>`n    <description>$(& $x ([string]$i.desc))</description>`n  </item>`n"
  }
  $xml += "</channel>`n</rss>`n"
  $utf8 = New-Object Text.UTF8Encoding($false)
  $was = ''
  if (Test-Path -LiteralPath $Feed) { $was = [IO.File]::ReadAllText($Feed, $utf8) }
  if ($was -ne $xml) {
    [IO.File]::WriteAllText($Feed, $xml, $utf8)
    "Feed written: $($items.Count) items"
  }
}

if (Test-Path -LiteralPath $outFull) {
  $old = [IO.File]::ReadAllText($outFull, [Text.Encoding]::UTF8)
  $oldCount = [regex]::Matches($old, '"run"\s*:').Count
  if ($byKey.Count -lt $oldCount -and -not $AllowShrink) {
    throw "The source has $($byKey.Count) official readings but $oldCount are already published. Nothing written. Pass -AllowShrink if rows were removed on purpose."
  }
  # Leave the file alone when only the timestamp would change.
  $strip = { param($s) ($s -replace '(?m)^\s*generated:.*$', '') -replace '\s+', '' }
  if ((& $strip $old) -eq (& $strip $js)) {
    "No change: $($byKey.Count) official readings, last $($keys | Select-Object -Last 1)"
    return
  }
}

[IO.File]::WriteAllText($outFull, $js, (New-Object Text.UTF8Encoding($false)))

"Wrote $($byKey.Count) official readings to $outFull"
"First: $($keys | Select-Object -First 1)   Last: $($keys | Select-Object -Last 1)"
if ($noComps.Count) { "Published without component scores: $($noComps -join ', ')" }
if ($skipped.Count) { "Skipped:"; $skipped | ForEach-Object { "  $_" } }
