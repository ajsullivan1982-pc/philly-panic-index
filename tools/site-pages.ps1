<#
Writes the readings into the site as plain HTML, for search engines and AI crawlers that
read pages without running JavaScript. Dot-sourced by update-data.ps1, which supplies
$root, $inv, $tz, $byKey and $keys, then calls Update-SitePages.

What it writes, each file only when its contents change:
  index.html          figures inside the elements assets/app.js draws, and the ppi:ld block
  eagles.html etc.    figures inside the elements assets/team.js draws, and the ppi:meta block
  prints/<date>.html  one page per official print
  prints/index.html   every official print
  sitemap.xml         every page, with last-changed dates
  llms.txt            a plain-text summary of the site and the latest print

The scripts in assets/ redraw those elements in the browser, so visitors see no change.
Keep this file ASCII: Windows PowerShell 5.1 misreads other characters in a file without
a byte-order mark. Non-ASCII output is written as HTML entities or [char] codes.
#>

$site = 'https://phillypanic.com/'
$utf8 = New-Object Text.UTF8Encoding($false)
$MID = [char]0x00B7   # middle dot, for text that is not HTML

$TeamInfo = @(
  [pscustomobject]@{ id = 'eagles'; name = 'Eagles'; tk = 'BRDS'; full = 'Philadelphia Eagles'; sport = 'American football'; league = 'NFL'; rx = '\beagles\b' },
  [pscustomobject]@{ id = 'phillies'; name = 'Phillies'; tk = 'PHLS'; full = 'Philadelphia Phillies'; sport = 'Baseball'; league = 'MLB'; rx = '\bphillies\b' },
  [pscustomobject]@{ id = 'sixers'; name = 'Sixers'; tk = 'SIXR'; full = 'Philadelphia 76ers'; sport = 'Basketball'; league = 'NBA'; rx = '\b(sixers|76ers)\b' },
  [pscustomobject]@{ id = 'flyers'; name = 'Flyers'; tk = 'FLYR'; full = 'Philadelphia Flyers'; sport = 'Ice hockey'; league = 'NHL'; rx = '\bflyers\b' }
)

# Methodology v1.2, the same order and weights as assets/core.js.
$CompInfo = @(
  [pscustomobject]@{ name = 'Performance'; short = 'PERF'; w = 0.30 },
  [pscustomobject]@{ name = 'Expectations vs Reality'; short = 'EXPT'; w = 0.20 },
  [pscustomobject]@{ name = 'Stakes'; short = 'STKS'; w = 0.15 },
  [pscustomobject]@{ name = 'Injuries & Roster News'; short = 'INJ'; w = 0.15 },
  [pscustomobject]@{ name = 'Fan & Media Sentiment'; short = 'SENT'; w = 0.10 },
  [pscustomobject]@{ name = 'Historical Trauma'; short = 'TRMA'; w = 0.10 }
)

$BandInfo = @(
  @(0, '0-19', 'PARADE CONDITIONS', 0), @(20, '20-34', "WE'RE FINE", 0), @(35, '35-49', 'RESTLESS', 1),
  @(50, '50-64', 'CONCERNED', 1), @(65, '65-79', 'HIGH ANXIETY', 2), @(80, '80-89', 'WOODER BOILING', 2),
  @(90, '90-97', 'FIRE EVERYBODY', 2), @(98, '98-100', 'CIVIC EMERGENCY', 2)
)

function Esc([string]$s) { $s.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;').Replace('"', '&quot;') }
function F1($n) { [math]::Round([double]$n, 1, [MidpointRounding]::AwayFromZero).ToString('0.0', $inv) }
function R1($n) { [math]::Round([double]$n, 1, [MidpointRounding]::AwayFromZero) }
function Num($n) { ([double]$n).ToString($inv) }
function Get-Dir($d) { if ($d -gt 0.04) { 'up' } elseif ($d -lt -0.04) { 'down' } else { 'flat' } }
function MoveHtml($d) {
  $a = @{ up = '&#9650;'; down = '&#9660;'; flat = '&#8594;' }[(Get-Dir $d)]
  "<span class=`"$(Get-Dir $d)`">$a $(F1 ([math]::Abs($d)))</span>"
}
function MoveWords($d, [string]$tail) {
  switch (Get-Dir $d) { 'up' { "up $(F1 $d)$tail" } 'down' { "down $(F1 (-$d))$tail" } default { "unchanged$tail" } }
}
function Get-Day([string]$iso) { [datetime]::ParseExact($iso, 'yyyy-MM-dd', $inv) }
function DateLong([string]$iso) { (Get-Day $iso).ToString('MMM d, yyyy', $inv).ToUpper() }
function DateShort([string]$iso) { (Get-Day $iso).ToString('MMM d', $inv).ToUpper() }
function DateText([string]$iso) { (Get-Day $iso).ToString('MMM d, yyyy', $inv) }
function DateFull([string]$iso) { (Get-Day $iso).ToString('MMMM d, yyyy', $inv) }
function Heat($v) {
  if ($null -eq $v) { return '<td class="heat num dim">&#8211;</td>' }
  "<td class=`"heat num`" style=`"background:rgba(255,61,82,$(([double]$v / 100 * 0.8).ToString('0.00', $inv)))`">$(Num $v)</td>"
}
function Get-Band([string]$status) {
  $s = $status.ToUpper().Replace([string][char]0x2019, "'").Replace([string][char]0x2018, "'").Trim()
  foreach ($b in $BandInfo) { if ($b[2] -eq $s) { return $b } }
  return $null
}
function Get-Rating($score, $move) {
  if ($move -ge 0.05) { return @('PANIC: UPGRADE', 'up') }
  if ($move -le -0.05) { return @('REDUCE PANIC', 'down') }
  if ($score -ge 90) { return @('HOLD MAX PANIC', 'up') }
  if ($score -lt 35) { return @('UNDERWEIGHT PANIC', 'down') }
  return @('HOLD PANIC', 'am')
}
function Get-Iso([string]$run) {
  # "2026-11-18 05:00 ET" to "2026-11-18T05:00:00-05:00"
  $d = [datetime]::ParseExact($run.Substring(0, 16), 'yyyy-MM-dd HH:mm', $inv)
  $o = $tz.GetUtcOffset($d)
  $sign = '+'; if ($o -lt [TimeSpan]::Zero) { $sign = '-'; $o = $o.Negate() }
  $d.ToString('yyyy-MM-ddTHH:mm:ss', $inv) + $sign + $o.ToString('hh\:mm', $inv)
}
function RunTime([string]$run) {
  $d = [datetime]::ParseExact($run.Substring(11, 5), 'HH:mm', $inv)
  $d.ToString('h:mm tt', $inv) + ' ET'
}
# JSON for a <script type="application/ld+json"> block. "</" is escaped so text can never close the tag.
# Windows PowerShell 5.1 writes ' & < > as \u escapes and PowerShell 7 does not. Both are valid
# JSON; the output is normalized so a page does not change with the machine that wrote it.
function To-LdJson($o) {
  $j = $o | ConvertTo-Json -Depth 8 -Compress
  $j = [regex]::Replace($j, '\\u00(27|26|3[cCeE])', { param($m) [string][char][Convert]::ToInt32($m.Groups[1].Value, 16) })
  $j.Replace('</', '<\/')
}
# Teams by a value, highest first. Ties keep the order of $TeamInfo, like the stable sort in the browser.
function Sort-Teams([scriptblock]$value) {
  $i = 0
  @($TeamInfo | ForEach-Object { [pscustomobject]@{ t = $_; v = [double](& $value $_); i = $i++ } } |
      Sort-Object @{ Expression = 'v'; Descending = $true }, @{ Expression = 'i'; Descending = $false } | ForEach-Object { $_.t })
}

# Replaces the contents of the element with this id. The element must not contain another
# element of its own tag name, which holds for every id used here.
function Set-Inner([string]$html, [string]$id, [string]$content) {
  $m = [regex]::Match($html, '(?s)(<(\w+)\b[^>]*\bid="' + [regex]::Escape($id) + '"[^>]*>).*?(</\2>)')
  if (-not $m.Success) { return $html }
  $html.Substring(0, $m.Groups[1].Index + $m.Groups[1].Length) + $content + $html.Substring($m.Groups[3].Index)
}
# Replaces what sits between <!-- ppi:name ... --> and <!-- /ppi:name -->.
function Set-Block([string]$html, [string]$name, [string]$content) {
  $m = [regex]::Match($html, '(?s)(<!-- ppi:' + $name + '\b[^>]*-->).*?(<!-- /ppi:' + $name + ' -->)')
  if (-not $m.Success) { return $html }
  $nl = "`n"; if ($html.Contains("`r`n")) { $nl = "`r`n" }
  $html.Substring(0, $m.Groups[1].Index + $m.Groups[1].Length) + $nl + $content + $nl + $html.Substring($m.Groups[2].Index)
}
# Writes only when the text differs, ignoring line endings (Git may check files out with CRLF).
function Write-IfChanged([string]$path, [string]$text) {
  if (Test-Path -LiteralPath $path) {
    $was = [IO.File]::ReadAllText($path, $utf8)
    if ($was.Replace("`r`n", "`n") -eq $text.Replace("`r`n", "`n")) { return $false }
  }
  $dir = Split-Path -Parent $path
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  [IO.File]::WriteAllText($path, $text, $utf8)
  return $true
}

$Org = [ordered]@{ '@type' = 'Organization'; '@id' = "${site}#org"; name = 'Philly Panic Index'; url = $site
  logo = [ordered]@{ '@type' = 'ImageObject'; url = "${site}assets/icon-512.png"; width = 512; height = 512 }
  sameAs = @('https://x.com/phlpanicindex', 'https://instagram.com/phlpanicindex') }
function TeamLd($t) { [ordered]@{ '@type' = 'SportsTeam'; name = $t.full; sport = $t.sport; memberOf = [ordered]@{ '@type' = 'SportsOrganization'; name = $t.league } } }

# The shared page frame for the generated pages, matching the research notes.
function Page-Head([string]$title, [string]$desc, [string]$url, [string]$ogType, [string]$ld) {
  @"
<!doctype html>
<!-- Generated by tools/site-pages.ps1 from the published readings. Do not edit by hand. -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>$(Esc $title)</title>
<meta name="description" content="$(Esc $desc)">
<link rel="canonical" href="$url">
<meta property="og:title" content="$(Esc $title)">
<meta property="og:description" content="$(Esc $desc)">
<meta property="og:type" content="$ogType">
<meta property="og:url" content="$url">
<meta property="og:site_name" content="Philly Panic Index">
<meta property="og:image" content="${site}assets/card.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@phlpanicindex">
<meta name="theme-color" content="#040605">
<link rel="icon" href="/assets/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/icon-180.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="alternate" type="application/rss+xml" title="Philly Panic Index" href="/feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/style.css?v=11">
<script type="application/ld+json">$ld</script>
</head>
<body>
<div class="wrap">
  <header class="mast">
    <div>
      <h1 class="wordmark"><a href="/">Philly <em>Panic</em> Index</a></h1>
      <p class="tagline">The numbers are real. The analysis is unnecessary.</p>
    </div>
    <div class="mast-meta">
      <div class="date">THE TAPE</div>
      <div>Official prints</div>
    </div>
  </header>

  <nav class="fn" aria-label="Sections">
    <a href="/#index">F1 INDEX</a>
    <a href="/#teams">F2 TEAMS</a>
    <a href="/#desk">F3 DESK</a>
    <a class="on" href="/prints/">F4 TAPE</a>
    <a href="/methodology.html">F5 METHODOLOGY</a>
    <a href="/research.html">F6 RESEARCH</a>
    <a href="/weekly.html">F7 WEEKLY</a>
    <span class="sp"></span>
    <a href="https://x.com/phlpanicindex" rel="noopener" aria-label="X @phlpanicindex">X <span class="handle">@phlpanicindex</span></a>
    <a href="https://instagram.com/phlpanicindex" rel="noopener" aria-label="Instagram @phlpanicindex">IG <span class="handle">@phlpanicindex</span></a>
  </nav>

"@
}
$PageFoot = @'

  <footer class="foot">
    <div>
      <p class="slogan">Updated daily and whenever disaster strikes.</p>
      <p>PPI measures panic, not team quality. It is not a forecast, a win probability, investment advice or emotional advice.</p>
      <p>Not affiliated with the Eagles, Phillies, Sixers, Flyers or any league.</p>
      <p>Tips, corrections, complaints: <a href="&#109;&#97;&#105;&#108;&#116;&#111;&#58;&#97;&#106;&#64;&#112;&#104;&#105;&#108;&#108;&#121;&#112;&#97;&#110;&#105;&#99;&#46;&#99;&#111;&#109;">&#97;&#106;&#64;&#112;&#104;&#105;&#108;&#108;&#121;&#112;&#97;&#110;&#105;&#99;&#46;&#99;&#111;&#109;</a></p>
    </div>
    <div><p><a href="/prints/">All official prints</a> &middot; <a href="/methodology.html">Methodology</a> &middot; <a href="/">Back to the index</a></p></div>
  </footer>
</div>
<script data-goatcounter="https://phillypanic.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>
</body>
</html>
'@

function Update-SitePages {
  # One print per day: the last official run on each date.
  $byDate = [ordered]@{}
  foreach ($k in $keys) { $byDate[$byKey[$k].date] = $byKey[$k] }
  $P = @($byDate.Values)
  $n = $P.Count
  $cur = $P[$n - 1]
  $prev = $null; if ($n -gt 1) { $prev = $P[$n - 2] }
  $ver = $cur.version
  $written = @()

  $score = { param($r, $id) [double]$r.teams[$id].score }
  $teamMove = { param($i, $id) if ($i -gt 0) { R1 ((& $score $P[$i] $id) - (& $score $P[$i - 1] $id)) } else { 0.0 } }
  $contrib = { param($r, $id) [double]$r.teams[$id].score * [double]$r.teams[$id].weight / 100 }
  $printUrl = { param($r) "/prints/$($r.date).html" }
  $byWeight = { param($r) Sort-Teams { param($t) $r.teams[$t.id].weight } }

  # The four teams on one print, as a table: used on each print page and on the homepage.
  $teamTable = {
    param($i, [bool]$isHome)
    $r = $P[$i]
    $total = 0.0; foreach ($t in $TeamInfo) { $total += & $contrib $r $t.id }
    $head = "<thead><tr><th>Ticker</th><th>TPS</th><th>Chg</th>" + (($CompInfo | ForEach-Object { "<th class=`"heat`" title=`"$(Esc $_.name), $([int]($_.w * 100))% of team score`">$($_.short)</th>" }) -join '') +
      "<th>City wt</th><th>Contrib</th><th class=`"l`">Desk rating</th></tr></thead><tbody>"
    $rows = foreach ($t in (& $byWeight $r)) {
      $d = $r.teams[$t.id]
      $m = & $teamMove $i $t.id
      $rt = Get-Rating ([double]$d.score) $m
      $cells = if ($d.c) { ($d.c | ForEach-Object { Heat $_ }) -join '' } else { (1..6 | ForEach-Object { Heat $null }) -join '' }
      $href = if ($isHome) { "$($t.id).html" } else { "/$($t.id).html" }
      "<tr><td class=`"tk`"><a href=`"$href`" style=`"color:var(--$($t.id))`">$($t.tk)<small>$($t.name)</small></a></td><td class=`"score num`" style=`"color:var(--$($t.id))`">$(F1 $d.score)</td><td class=`"num`">$(if ($i -gt 0) { MoveHtml $m } else { '<span class="dim">&#8211;</span>' })</td>$cells<td class=`"num`">$(F1 $d.weight)%</td><td class=`"num`">$((& $contrib $r $t.id).ToString('0.00', $inv))</td><td class=`"l`"><span class=`"rating $($rt[1])`" style=`"margin:0`">$($rt[0])</span></td></tr>"
    }
    $head + ($rows -join '') + '</tbody>'
  }

  # ---- One page per print ----
  $printsDir = Join-Path $root 'prints'
  $keep = @{}
  for ($i = 0; $i -lt $n; $i++) {
    $r = $P[$i]
    $url = "$site" + "prints/$($r.date).html"
    $keep["$($r.date).html"] = $true
    $band = Get-Band $r.status
    $mv = [double]$r.move
    $ranked = Sort-Teams { param($t) & $score $r $t.id }
    $teamsLine = ($TeamInfo | ForEach-Object { "$($_.name) $(F1 (& $score $r $_.id))" }) -join ', '
    $title = "Philly Panic Index, $(DateText $r.date): $(F1 $r.city) ($($r.status))"
    $short = $r.driver; if ($short.Length -gt 150) { $short = $short.Substring(0, 147).TrimEnd() + '...' }
    $desc = "Official print for $(DateText $r.date): citywide PPI $(F1 $r.city), $(MoveWords $mv ''), $($r.status). $teamsLine. $short"

    $ld = To-LdJson ([ordered]@{
        '@context' = 'https://schema.org'; '@type' = 'Article'
        headline = $title; description = $desc; url = $url; mainEntityOfPage = $url
        datePublished = Get-Iso $r.run; dateModified = Get-Iso $r.run
        image = "${site}assets/card.png"
        author = [ordered]@{ '@type' = 'Organization'; name = 'Philly Panic Index'; url = $site }
        publisher = $Org
        isPartOf = [ordered]@{ '@type' = 'Dataset'; '@id' = "${site}#dataset"; name = 'Philly Panic Index official prints' }
        about = @($TeamInfo | ForEach-Object { TeamLd $_ })
      })

    $bandText = ''; if ($band) { $bandText = " ($($band[1]))" }
    $lead = "The citywide Philly Panic Index printed <b>$(F1 $r.city)</b> at $(RunTime $r.run) on $(DateFull $r.date), $(MoveWords $mv ' from the prior official print'). Market status: <b>$(Esc $r.status)</b>$bandText. " +
      "Most panicked: the $($ranked[0].name) at $(F1 (& $score $r $ranked[0].id)). Calmest: the $($ranked[3].name) at $(F1 (& $score $r $ranked[3].id))."
    $nav = @()
    if ($i -gt 0) { $nav += "<a class=`"share`" href=`"$(& $printUrl $P[$i - 1])`" rel=`"prev`">&larr; $(DateText $P[$i - 1].date)</a>" }
    if ($i -lt $n - 1) { $nav += "<a class=`"share`" href=`"$(& $printUrl $P[$i + 1])`" rel=`"next`">$(DateText $P[$i + 1].date) &rarr;</a>" }

    $html = (Page-Head $title $desc $url 'article' $ld) + @"
  <main>
    <section class="panel" style="margin:12px 0">
      <header><span>Official print</span><span>$(DateLong $r.date) &middot; $(RunTime $r.run)</span></header>
      <article class="article">
        <div class="art-k">Official print &middot; $(Esc $r.version)</div>
        <h2 class="art-title">PPI $(F1 $r.city) &middot; $(Esc $r.status)</h2>
        <p class="art-dek">$(Esc $r.driver)</p>
        <div class="art-meta">
          <span>$((MoveWords $mv ' from the prior print').Substring(0, 1).ToUpper() + (MoveWords $mv ' from the prior print').Substring(1))</span>
          <span>$(DateText $r.date), $(RunTime $r.run)</span>
          <span>Print $($i + 1) of $n on record</span>
        </div>

        <div class="prose">
          <p>$lead</p>
          <h2>The four teams</h2>
          <div class="scroll"><table>$(& $teamTable $i $false)</table></div>
          <p>Each team panic score (TPS) is a weighted sum of six components: $(($CompInfo | ForEach-Object { "$(Esc $_.name) $([int]($_.w * 100))%" }) -join ', '). The citywide reading weights the four team scores by the city weights shown. <a href="/methodology.html">How the index is calculated</a>.</p>
        </div>

        <div class="art-foot">
          $($nav -join "`n          ")
          <span><a href="/prints/">All official prints</a> &middot; <a href="/">Latest print</a></span>
        </div>
      </article>
    </section>
  </main>
"@ + $PageFoot
    if (Write-IfChanged (Join-Path $printsDir "$($r.date).html") $html) { $written += "prints/$($r.date).html" }
  }
  # A print removed from the log loses its page too.
  if (Test-Path -LiteralPath $printsDir) {
    foreach ($f in (Get-ChildItem -LiteralPath $printsDir -Filter '*.html')) {
      if ($f.Name -ne 'index.html' -and -not $keep[$f.Name]) { Remove-Item -LiteralPath $f.FullName; $written += "prints/$($f.Name) (removed)" }
    }
  }

  # ---- The archive: every print, newest first ----
  $tapeHead = "<thead><tr><th>Print</th><th>PPI</th><th>Chg</th><th class=`"l`">Status</th>" + (($TeamInfo | ForEach-Object { "<th>$($_.tk)</th>" }) -join '') + "<th class=`"l`">Primary panic driver</th></tr></thead><tbody>"
  $tapeRow = {
    param($r, [bool]$isCur)
    $b = Get-Band $r.status; $sev = 2; if ($b) { $sev = $b[3] }
    "<tr class=`"$(if ($isCur) { 'cur' })`"><td><a href=`"$(& $printUrl $r)`">$(DateLong $r.date)</a></td><td class=`"num`"><b>$(F1 $r.city)</b></td><td class=`"num`">$(MoveHtml ([double]$r.move))</td><td class=`"l sev-$sev`">$(Esc $r.status)</td>" +
      (($TeamInfo | ForEach-Object { "<td class=`"num`">$(F1 $r.teams[$_.id].score)</td>" }) -join '') + "<td class=`"wrap-cell`">$(Esc $r.driver)</td></tr>"
  }
  $tapeList = {
    param($r, [bool]$isCur)
    $b = Get-Band $r.status; $sev = 2; if ($b) { $sev = $b[3] }
    "<li class=`"$(if ($isCur) { 'cur' })`"><div class=`"tl-top`"><span><a href=`"$(& $printUrl $r)`">$(DateLong $r.date)</a></span><b class=`"num`">$(F1 $r.city)</b><span class=`"num`">$(MoveHtml ([double]$r.move))</span></div><div class=`"tl-status sev-$sev`">$(Esc $r.status)</div><div class=`"tl-teams num`">" +
      (($TeamInfo | ForEach-Object { "$($_.tk) $(F1 $r.teams[$_.id].score)" }) -join ' &middot; ') + "</div><p>$(Esc $r.driver)</p></li>"
  }
  $rev = @($P[($n - 1)..0])
  # The first print to reach the high or the low, as on the homepage.
  $hi = $P[0]; $lo = $P[0]
  foreach ($r in $P) { if ([double]$r.city -gt [double]$hi.city) { $hi = $r }; if ([double]$r.city -lt [double]$lo.city) { $lo = $r } }
  $aUrl = "${site}prints/"
  $aTitle = "Every official print $MID Philly Panic Index"
  $aDesc = "All $n official prints of the Philly Panic Index since $(DateText $P[0].date): the citywide reading, market status, the four team scores and the primary panic driver for each day."
  $aLd = To-LdJson ([ordered]@{ '@context' = 'https://schema.org'; '@type' = 'CollectionPage'; name = $aTitle; description = $aDesc; url = $aUrl
      isPartOf = [ordered]@{ '@type' = 'WebSite'; '@id' = "${site}#website"; name = 'Philly Panic Index'; url = $site }
      mainEntity = [ordered]@{ '@type' = 'Dataset'; '@id' = "${site}#dataset"; name = 'Philly Panic Index official prints' } })
  $archive = (Page-Head $aTitle $aDesc $aUrl 'website' $aLd) + @"
  <main>
    <section class="panel" style="margin:12px 0">
      <header><span>The Tape &middot; Every official print</span><span>$n</span></header>
      <div class="body">
        <p>$n official prints from $(DateText $P[0].date) to $(DateText $cur.date). High $(F1 $hi.city) ($(DateText $hi.date)), low $(F1 $lo.city) ($(DateText $lo.date)). Latest: $(F1 $cur.city), $(Esc $cur.status). Each date opens that day's print.</p>
      </div>
      <div class="scroll wide-only">
        <table>$tapeHead$(($rev | ForEach-Object -Begin { $first = $true } -Process { & $tapeRow $_ $first; $first = $false }) -join '')</tbody></table>
      </div>
      <div class="narrow-only">
        <ol class="tape-list">$(($rev | ForEach-Object -Begin { $first = $true } -Process { & $tapeList $_ $first; $first = $false }) -join '')</ol>
      </div>
    </section>
  </main>
"@ + $PageFoot
  if (Write-IfChanged (Join-Path $printsDir 'index.html') $archive) { $written += 'prints/index.html' }

  # ---- Homepage: the elements assets/app.js draws ----
  $homePath = Join-Path $root 'index.html'
  if (Test-Path -LiteralPath $homePath) {
    $html = [IO.File]::ReadAllText($homePath, $utf8)
    $new = $html
    $pct = 0.0; if ($prev) { $pct = [double]$cur.move / [double]$prev.city * 100 }
    $sign = ''; if ($cur.move -gt 0) { $sign = '+' } elseif ($cur.move -lt 0) { $sign = '&minus;' }
    $cm = [double]$cur.move
    $new = Set-Inner $new 'move' "<span class=`"$(Get-Dir $cm)`">$(@{ up = '&#9650;'; down = '&#9660;'; flat = '&#8594;' }[(Get-Dir $cm)]) $(F1 ([math]::Abs($cm)))<small>$sign$([math]::Abs($pct).ToString('0.00', $inv))% vs prior print</small></span>"
    $b = Get-Band $cur.status; $sev = 2; if ($b) { $sev = $b[3] }
    $new = Set-Inner $new 'status-chip' "<span class=`"status-chip sev-$sev`">$(Esc $cur.status)</span>"
    $new = Set-Inner $new 'team-table' (& $teamTable ($n - 1) $true)
    $first = $true
    $new = Set-Inner $new 'tape-table' ($tapeHead + (($rev | Select-Object -First 30 | ForEach-Object { $x = & $tapeRow $_ $first; $first = $false; $x }) -join '') + '</tbody>')
    $first = $true
    $new = Set-Inner $new 'tape-list' (($rev | Select-Object -First 10 | ForEach-Object { $x = & $tapeList $_ $first; $first = $false; $x }) -join '')
    $new = Set-Inner $new 'foot-data' "$n official prints on record &middot; $(Esc $ver) &middot; <a href=`"/prints/`">All prints</a>"

    $ld = To-LdJson ([ordered]@{ '@context' = 'https://schema.org'; '@graph' = @(
          [ordered]@{ '@type' = 'WebSite'; '@id' = "${site}#website"; name = 'Philly Panic Index'; alternateName = 'PPI'; url = $site
            description = 'A daily 0-100 index of fan panic surrounding the Eagles, Phillies, Sixers and Flyers.'; publisher = [ordered]@{ '@id' = "${site}#org" } },
          $Org,
          [ordered]@{ '@type' = 'Dataset'; '@id' = "${site}#dataset"; name = 'Philly Panic Index official prints'
            description = "A daily reading, on a scale of 0 to 100, of fan panic surrounding Philadelphia's four major professional teams: the Eagles (NFL), Phillies (MLB), 76ers (NBA) and Flyers (NHL). Each official print records a citywide reading, a market status, the four team panic scores, their six component scores and the city weights. It measures panic, not team quality, and is not a forecast."
            url = $site; sameAs = $aUrl; creator = [ordered]@{ '@id' = "${site}#org" }; isAccessibleForFree = $true
            temporalCoverage = "$($P[0].date)/$($cur.date)"; dateModified = Get-Iso $cur.run
            spatialCoverage = [ordered]@{ '@type' = 'Place'; name = 'Philadelphia, Pennsylvania' }
            keywords = @('Philadelphia sports', 'Eagles', 'Phillies', 'Sixers', 'Flyers', 'fan sentiment', 'panic index')
            variableMeasured = @('Citywide PPI', 'Market status', 'Team panic score', 'Performance', 'Expectations vs Reality', 'Stakes', 'Injuries & Roster News', 'Fan & Media Sentiment', 'Historical Trauma', 'City weight')
            distribution = @([ordered]@{ '@type' = 'DataDownload'; encodingFormat = 'application/rss+xml'; contentUrl = "${site}feed.xml" }) }
        ) })
    $new = Set-Block $new 'ld' "<script type=`"application/ld+json`">$ld</script>"
    if ($new -ne $html) { [IO.File]::WriteAllText($homePath, $new, $utf8); $written += 'index.html' }
  }

  # ---- Team pages: the elements assets/team.js draws ----
  foreach ($t in $TeamInfo) {
    $path = Join-Path $root "$($t.id).html"
    if (-not (Test-Path -LiteralPath $path)) { continue }
    $html = [IO.File]::ReadAllText($path, $utf8)
    $new = $html
    $d = $cur.teams[$t.id]
    $m = & $teamMove ($n - 1) $t.id
    $ranked = Sort-Teams { param($x) & $score $cur $x.id }
    $rank = [array]::IndexOf(@($ranked | ForEach-Object { $_.id }), $t.id)
    $place = @('Most panicked', 'Second most panicked', 'Third most panicked', 'Calmest')[$rank]

    $desc = "$($t.name) panic score, $(DateText $cur.date) official print: $(F1 $d.score), $(MoveWords $m ''). $place of Philadelphia's four teams. Today's reading, the six components behind it and every official print."
    $new = Set-Block $new 'meta' "<meta name=`"description`" content=`"$(Esc $desc)`">"
    $new = Set-Inner $new 'mast-date' (DateLong $cur.date)
    $new = Set-Inner $new 'score' (F1 $d.score)
    $pct = 0.0; if ($prev) { $pct = $m / (& $score $prev $t.id) * 100 }
    $sign = ''; if ($m -gt 0) { $sign = '+' } elseif ($m -lt 0) { $sign = '&minus;' }
    $new = Set-Inner $new 'move' "<span class=`"$(Get-Dir $m)`">$(@{ up = '&#9650;'; down = '&#9660;'; flat = '&#8594;' }[(Get-Dir $m)]) $(F1 ([math]::Abs($m)))<small>$sign$([math]::Abs($pct).ToString('0.00', $inv))% vs prior print</small></span>"
    $rt = Get-Rating ([double]$d.score) $m
    $new = Set-Inner $new 'rating' "<span class=`"status-chip $($rt[1])`">$($rt[0])</span>"

    $pc = $null; if ($prev -and $prev.teams[$t.id].c) { $pc = $prev.teams[$t.id].c }
    if ($d.c) {
      $items = for ($k = 0; $k -lt 6; $k++) {
        $v = [double]$d.c[$k]; $ch = 0.0; if ($pc) { $ch = $v - [double]$pc[$k] }
        $w = [math]::Max(0, [math]::Min(100, $v))
        "<li><div class=`"cb-top`"><span>$(Esc $CompInfo[$k].name) <span class=`"dim`">&middot; $([int]($CompInfo[$k].w * 100))%</span></span><span class=`"num`"><b>$(Num $v)</b> $(if ($pc -and $ch) { MoveHtml $ch })</span></div><div class=`"cb-bar`"><i style=`"width:$(Num $w)%;background:var(--$($t.id))`"></i></div></li>"
      }
      $new = Set-Inner $new 'comps' ($items -join '')
    } else {
      $new = Set-Inner $new 'comps' '<li class="dim">Component scores were not logged for this print.</li>'
    }
    $total = 0.0; foreach ($x in $TeamInfo) { $total += & $contrib $cur $x.id }
    $c = & $contrib $cur $t.id
    $new = Set-Inner $new 'weight' "City weight <b>$(F1 $d.weight)%</b> &middot; adds <b>$($c.ToString('0.00', $inv))</b> points to the citywide $(F1 $cur.city) &middot; <b>$(($c / $total * 100).ToString('0.0', $inv))%</b> of all panic in circulation"

    $named = @()
    for ($i = $n - 1; $i -ge 0; $i--) { if ($P[$i].driver -match "(?i)$($t.rx)") { $named += $i } }
    $new = Set-Inner $new 'heads-count' "$($named.Count) of $n prints"
    if ($named.Count) {
      $new = Set-Inner $new 'heads' (($named | Select-Object -First 8 | ForEach-Object { "<li><span class=`"k`"><a href=`"$(& $printUrl $P[$_])`">$(DateLong $P[$_].date)</a> &middot; $($t.tk) $(F1 (& $score $P[$_] $t.id)) $(MoveHtml (& $teamMove $_ $t.id))</span>$(Esc $P[$_].driver)</li>" }) -join '')
    } else {
      $new = Set-Inner $new 'heads' "<li class=`"dim`">The $($t.name) have not been named as the primary panic driver in any official print. Yet.</li>"
    }

    $head = "<thead><tr><th>Print</th><th>$($t.tk)</th><th>Chg</th>" + (($CompInfo | ForEach-Object { "<th class=`"heat`" title=`"$(Esc $_.name), $([int]($_.w * 100))% of team score`">$($_.short)</th>" }) -join '') + "<th>City wt</th><th>City PPI</th></tr></thead><tbody>"
    $rows = for ($i = $n - 1; $i -ge [math]::Max(0, $n - 30); $i--) {
      $r = $P[$i]; $x = $r.teams[$t.id]
      $cells = if ($x.c) { ($x.c | ForEach-Object { Heat $_ }) -join '' } else { (1..6 | ForEach-Object { Heat $null }) -join '' }
      "<tr class=`"$(if ($i -eq $n - 1) { 'cur' })`"><td><a href=`"$(& $printUrl $r)`">$(DateLong $r.date)</a></td><td class=`"num`"><b style=`"color:var(--$($t.id))`">$(F1 $x.score)</b></td><td class=`"num`">$(if ($i -gt 0) { MoveHtml (& $teamMove $i $t.id) } else { '<span class="dim">&#8211;</span>' })</td>$cells<td class=`"num`">$(F1 $x.weight)%</td><td class=`"num`">$(F1 $r.city)</td></tr>"
    }
    $new = Set-Inner $new 'tape-table' ($head + ($rows -join '') + '</tbody>')
    $items = for ($i = $n - 1; $i -ge [math]::Max(0, $n - 10); $i--) {
      $r = $P[$i]; $x = $r.teams[$t.id]
      $compsText = if ($x.c) { (0..5 | ForEach-Object { "$($CompInfo[$_].short) $(Num $x.c[$_])" }) -join ' &middot; ' } else { 'Components not logged' }
      "<li class=`"$(if ($i -eq $n - 1) { 'cur' })`"><div class=`"tl-top`"><span><a href=`"$(& $printUrl $r)`">$(DateLong $r.date)</a></span><b class=`"num`" style=`"color:var(--$($t.id))`">$(F1 $x.score)</b><span class=`"num`">$(if ($i -gt 0) { MoveHtml (& $teamMove $i $t.id) })</span></div><div class=`"tl-teams num`">$compsText</div><div class=`"tl-teams num`">City PPI $(F1 $r.city) &middot; weight $(F1 $x.weight)%</div></li>"
    }
    $new = Set-Inner $new 'tape-list' ($items -join '')
    $new = Set-Inner $new 'foot-data' "$n official prints on record &middot; $(Esc $ver)"
    if ($new -ne $html) { [IO.File]::WriteAllText($path, $new, $utf8); $written += "$($t.id).html" }
  }

  # ---- sitemap.xml ----
  $sm = @(
    @('', $cur.date, 'daily'),
    @('eagles.html', $cur.date, 'daily'), @('phillies.html', $cur.date, 'daily'),
    @('sixers.html', $cur.date, 'daily'), @('flyers.html', $cur.date, 'daily'),
    @('prints/', $cur.date, 'daily'),
    @('methodology.html', $null, 'monthly'), @('weekly.html', $null, 'weekly'), @('research.html', $null, 'weekly')
  )
  $research = Join-Path $root 'research'
  if (Test-Path -LiteralPath $research) {
    foreach ($f in (Get-ChildItem -LiteralPath $research -Filter '*.html' | Where-Object { $_.Name -notmatch '^_' } | Sort-Object Name)) {
      $mm = [regex]::Match([IO.File]::ReadAllText($f.FullName, $utf8), '<meta property="article:published_time" content="(\d{4}-\d{2}-\d{2})')
      $sm += , @("research/$($f.Name)", $(if ($mm.Success) { $mm.Groups[1].Value } else { $null }), $null)
    }
  }
  for ($i = $n - 1; $i -ge 0; $i--) {
    # A print page changes once more, when the next print adds its "next" link.
    $lm = $P[$i].date; if ($i -lt $n - 1) { $lm = $P[$i + 1].date }
    $sm += , @("prints/$($P[$i].date).html", $lm, $null)
  }
  $xml = "<?xml version=`"1.0`" encoding=`"UTF-8`"?>`n<!-- Generated by tools/site-pages.ps1. Do not edit by hand; new pages are picked up on the next run. -->`n<urlset xmlns=`"http://www.sitemaps.org/schemas/sitemap/0.9`">`n"
  foreach ($e in $sm) {
    $xml += "  <url><loc>$site$($e[0])</loc>" + $(if ($e[1]) { "<lastmod>$($e[1])</lastmod>" }) + $(if ($e[2]) { "<changefreq>$($e[2])</changefreq>" }) + "</url>`n"
  }
  $xml += "</urlset>`n"
  if (Write-IfChanged (Join-Path $root 'sitemap.xml') $xml) { $written += 'sitemap.xml' }

  # ---- llms.txt: a plain summary for language-model tools (llmstxt.org) ----
  $notes = @()
  if (Test-Path -LiteralPath $research) {
    foreach ($f in (Get-ChildItem -LiteralPath $research -Filter '*.html' | Where-Object { $_.Name -notmatch '^_' })) {
      $txt = [IO.File]::ReadAllText($f.FullName, $utf8)
      $g = { param($p) $mm = [regex]::Match($txt, $p); if ($mm.Success) { [Net.WebUtility]::HtmlDecode($mm.Groups[1].Value) } }
      $notes += [pscustomobject]@{ t = & $g '<meta property="og:title" content="([^"]*)"'; d = & $g '<meta name="description" content="([^"]*)"'; u = & $g '<link rel="canonical" href="([^"]*)"'; at = & $g '<meta property="article:published_time" content="([^"]*)"' }
    }
  }
  $noteLines = ($notes | Where-Object { $_.t -and $_.u } | Sort-Object @{ Expression = 'at'; Descending = $true }, @{ Expression = 'u'; Descending = $false } | ForEach-Object { "- [$($_.t)]($($_.u)): $($_.at). $($_.d)" }) -join "`n"
  $teamLines = ($TeamInfo | ForEach-Object {
      $x = $cur.teams[$_.id]
      "- $($_.name) ($($_.league)): $(F1 $x.score), $(MoveWords (& $teamMove ($n - 1) $_.id) ''); city weight $(F1 $x.weight)%"
    }) -join "`n"
  $bandLines = ($BandInfo | ForEach-Object { "$($_[1]) $($_[2])" }) -join '; '
  $llms = @"
# Philly Panic Index

> A daily index, on a scale of 0 to 100, of fan panic surrounding Philadelphia's four major professional teams: the Eagles (NFL), Phillies (MLB), Sixers (76ers, NBA) and Flyers (NHL). A new "official print" is published most mornings at 5:00 AM ET. The tone is satirical but the arithmetic is real and documented. It measures panic, not team quality, and it is not a forecast, a win probability or betting advice. Not affiliated with any team or league.

## Latest official print: $(DateText $cur.date), $(RunTime $cur.run)

- Citywide PPI: $(F1 $cur.city), $(MoveWords ([double]$cur.move) ' from the prior print')
- Market status: $($cur.status)
$teamLines
- Primary panic driver: $($cur.driver)
- Page for this print: ${site}prints/$($cur.date).html
- Official prints on record: $n, from $(DateText $P[0].date) to $(DateText $cur.date). Range: high $(F1 $hi.city) ($(DateText $hi.date)), low $(F1 $lo.city) ($(DateText $lo.date)).

## How it is calculated ($ver)

- Each team panic score is a weighted sum of six components, each scored 0 to 100: $(($CompInfo | ForEach-Object { "$($_.name) $([int]($_.w * 100))%" }) -join ', ').
- The citywide reading is the sum of each team score times its city weight. The weights total 100% and follow the sports calendar.
- Market status bands for the citywide reading: $bandLines.
- If a day's reading is missing or unverified, nothing is carried forward; the site shows the last official print with its date.

## Pages

- [Homepage]($site): the latest print, team components, desk notes and recent prints
- [Every official print]($aUrl): the full history, one page per day
$(($TeamInfo | ForEach-Object { "- [$($_.name) panic score]($site$($_.id).html): today's reading, the six components and every print" }) -join "`n")
- [Methodology](${site}methodology.html): how the index is calculated
- [Weekly Panic Report](${site}weekly.html): the latest Monday-to-Sunday week summarized
- [Research notes](${site}research.html): longer pieces from the desk
- [RSS feed](${site}feed.xml): official prints and research notes

## Research notes

$noteLines

## Elsewhere

- X: https://x.com/phlpanicindex
- Instagram: https://instagram.com/phlpanicindex
"@
  $llms = $llms.Replace("`r`n", "`n") + "`n"
  if (Write-IfChanged (Join-Path $root 'llms.txt') $llms) { $written += 'llms.txt' }

  if ($written.Count) { "Site pages written: $($written.Count) ($((@($written | Select-Object -First 6)) -join ', ')$(if ($written.Count -gt 6) { ', ...' }))" }
}
