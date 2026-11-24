// One team's page: eagles.html, phillies.html, sixers.html and flyers.html all run this.
// The team is named on <body data-team="...">. Every figure comes from the published
// readings; nothing is recalculated or filled in.
(function () {
  const { TEAMS, COMPS, readings, f1, r1, esc, dir, arrow, moveHtml, day, dayDiff, dateShort, dateLong, todayET } = window.PPI;
  const $ = id => document.getElementById(id);
  // Each print has its own page, written by tools/site-pages.ps1.
  const printLink = r => `<a href="/prints/${r.date}.html">${dateLong(r.date)}</a>`;
  const team = TEAMS.find(t => t.id === document.body.dataset.team);
  if (!team) return;

  if (!readings.length) {
    $('banner').innerHTML = '<div class="banner">NO OFFICIAL PRINTS LOADED. The board stays dark until there is a verified reading.</div>';
    return;
  }

  const cur = readings[readings.length - 1];
  const prev = readings.length > 1 ? readings[readings.length - 2] : null;
  const d = cur.teams[team.id];
  const score = r => r.teams[team.id].score;
  // Change in this team's score from the print before it.
  const moveAt = i => (i > 0 ? r1(score(readings[i]) - score(readings[i - 1])) : 0);
  const move = moveAt(readings.length - 1);

  // Masthead and freshness, same rules as the homepage.
  const age = dayDiff(cur.date, todayET());
  $('mast-date').textContent = dateLong(cur.date);
  $('mast-state').innerHTML = age <= 0
    ? '<span class="live">● TODAY\'S OFFICIAL PRINT</span>'
    : `<span class="stale-dot">● LAST OFFICIAL PRINT · ${age} DAY${age === 1 ? '' : 'S'} AGO</span>`;
  if (age > 0) {
    $('banner').innerHTML = `<div class="banner">NO OFFICIAL PRINT ON THE BOARD TODAY. Showing the last official reading, ${dateLong(cur.date)}. We do not carry numbers forward or make them up. Only the jokes.</div>`;
  }

  // Hero
  $('score').textContent = f1(d.score);
  const pct = prev ? (move / score(prev)) * 100 : 0;
  $('move').innerHTML = `<span class="${dir(move)}">${arrow(move)} ${f1(Math.abs(move))}<small>${move > 0 ? '+' : move < 0 ? '−' : ''}${Math.abs(pct).toFixed(2)}% vs prior print</small></span>`;
  const rating = (() => {
    if (move >= 0.05) return ['PANIC: UPGRADE', 'up'];
    if (move <= -0.05) return ['REDUCE PANIC', 'down'];
    if (d.score >= 90) return ['HOLD MAX PANIC', 'up'];
    if (d.score < 35) return ['UNDERWEIGHT PANIC', 'down'];
    return ['HOLD PANIC', 'am'];
  })();
  $('rating').innerHTML = `<span class="status-chip ${rating[1]}">${rating[0]}</span>`;

  // Share: the phone's share sheet where there is one, otherwise a prefilled post on X.
  const url = `https://phillypanic.com/${team.id}.html`;
  $('share-team').addEventListener('click', () => {
    const signed = dir(move) === 'flat' ? 'unch' : `${arrow(move)}${f1(Math.abs(move))}`;
    const text = `${team.tk} ${f1(d.score)} (${signed}): ${team.name} panic, ${dateShort(cur.date)} official print. Citywide PPI ${f1(cur.city)}, ${cur.status}. via @phlpanicindex`;
    try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: `share-page-${team.id}`, title: `share-page-${team.id}`, event: true }); } catch (e) { /* never block a share */ }
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) { navigator.share({ text, url }).catch(() => {}); return; }
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener');
  });

  // Components: the six inputs to this team's score, with the change from the prior print.
  const pc = prev && prev.teams[team.id].c ? prev.teams[team.id].c : null;
  $('comps').innerHTML = d.c
    ? COMPS.map((c, i) => {
      const v = d.c[i], ch = pc ? v - pc[i] : 0;
      return `<li><div class="cb-top"><span>${c.name} <span class="dim">· ${Math.round(c.w * 100)}%</span></span><span class="num"><b>${v}</b> ${pc && ch ? moveHtml(ch) : ''}</span></div><div class="cb-bar"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${team.color}"></i></div></li>`;
    }).join('')
    : '<li class="dim">Component scores were not logged for this print.</li>';
  const contrib = t => cur.teams[t.id].score * cur.teams[t.id].weight / 100;
  const total = TEAMS.reduce((s, t) => s + contrib(t), 0);
  $('weight').innerHTML = `City weight <b>${f1(d.weight)}%</b> · adds <b>${contrib(team).toFixed(2)}</b> points to the citywide ${f1(cur.city)} · <b>${(contrib(team) / total * 100).toFixed(1)}%</b> of all panic in circulation`;

  // Desk notes. The figures are computed from the log. The commentary is not.
  const notes = [];
  const ranked = TEAMS.slice().sort((a, b) => cur.teams[b.id].score - cur.teams[a.id].score);
  const rank = ranked.indexOf(team) + 1;
  const place = ['Most panicked', 'Second most panicked', 'Third most panicked', 'Calmest'][rank - 1];
  notes.push(['Standing', `${place} of the four accounts at ${f1(d.score)}. ${rank === 1 ? 'A title, of a kind.' : rank === 4 ? 'The desk does not expect this to last.' : 'Room to move in either direction.'}`]);

  const hiI = readings.reduce((a, r, i) => (score(r) > score(readings[a]) ? i : a), 0);
  const loI = readings.reduce((a, r, i) => (score(r) < score(readings[a]) ? i : a), 0);
  notes.push(['Range on record', `High ${f1(score(readings[hiI]))} (${dateShort(readings[hiI].date)}), low ${f1(score(readings[loI]))} (${dateShort(readings[loI].date)}), across ${readings.length} official prints. Currently ${f1(score(readings[hiI]) - d.score)} below the high and ${f1(d.score - score(readings[loI]))} above the low.`]);

  let run = 0;
  const way = dir(move);
  if (way !== 'flat') { for (let i = readings.length - 1; i > 0 && dir(moveAt(i)) === way; i--) run++; }
  notes.push(['Momentum', way === 'flat'
    ? `Unchanged from the prior print. No news is not good news. It is merely no news.`
    : `${run} consecutive print${run === 1 ? '' : 's'} ${way === 'up' ? 'higher' : 'lower'}. ${way === 'up' ? 'The desk has stopped asking where the top is.' : 'Analysts caution against enjoying it.'}`]);

  if (d.c) {
    const topI = d.c.indexOf(Math.max(...d.c)), lowI = d.c.indexOf(Math.min(...d.c));
    const at100 = d.c.filter(v => v >= 100).length;
    notes.push(['Exposure', `Largest: ${COMPS[topI].name} at ${d.c[topI]}. Smallest: ${COMPS[lowI].name} at ${d.c[lowI]}.${at100 ? ` ${at100} component${at100 === 1 ? ' is' : 's are'} pinned at 100. The scale does not go higher.` : ''}`]);
  }
  $('notes').innerHTML = notes.map(([k, body]) => `<li><span class="k">${k}</span>${esc(body)}</li>`).join('');

  // Headlines: official prints whose primary driver named this team.
  const names = { eagles: /\beagles\b/i, phillies: /\bphillies\b/i, sixers: /\b(sixers|76ers)\b/i, flyers: /\bflyers\b/i }[team.id];
  const named = readings.map((r, i) => ({ r, i })).filter(x => names.test(x.r.driver)).reverse();
  $('heads-count').textContent = `${named.length} of ${readings.length} prints`;
  $('heads').innerHTML = named.length
    ? named.slice(0, 8).map(({ r, i }) => `<li><span class="k">${printLink(r)} · ${team.tk} ${f1(score(r))} ${moveHtml(moveAt(i))}</span>${esc(r.driver)}</li>`).join('')
    : `<li class="dim">The ${team.name} have not been named as the primary panic driver in any official print. Yet.</li>`;

  // Tape: every official print, this team only.
  const heat = v => (v == null ? '<td class="heat num dim">–</td>' : `<td class="heat num" style="background:rgba(255,61,82,${(v / 100 * 0.8).toFixed(2)})">${v}</td>`);
  const rows = readings.map((r, i) => ({ r, i })).reverse();
  $('tape-table').innerHTML =
    `<thead><tr><th>Print</th><th>${team.tk}</th><th>Chg</th>${COMPS.map(c => `<th class="heat" title="${c.name}, ${c.w * 100}% of team score">${c.short}</th>`).join('')}<th>City wt</th><th>City PPI</th></tr></thead><tbody>` +
    rows.map(({ r, i }, n) => {
      const t = r.teams[team.id];
      return `<tr class="${n === 0 ? 'cur' : ''}"><td>${printLink(r)}</td><td class="num"><b style="color:${team.color}">${f1(t.score)}</b></td><td class="num">${i > 0 ? moveHtml(moveAt(i)) : '<span class="dim">–</span>'}</td>${(t.c || [null, null, null, null, null, null]).map(heat).join('')}<td class="num">${f1(t.weight)}%</td><td class="num">${f1(r.city)}</td></tr>`;
    }).join('') + '</tbody>';

  const TAPE_SHORT = 10;
  let tapeAll = false;
  const drawTapeList = () => {
    $('tape-list').innerHTML = (tapeAll ? rows : rows.slice(0, TAPE_SHORT)).map(({ r, i }, n) => {
      const t = r.teams[team.id];
      return `<li class="${n === 0 ? 'cur' : ''}"><div class="tl-top"><span>${printLink(r)}</span><b class="num" style="color:${team.color}">${f1(t.score)}</b><span class="num">${i > 0 ? moveHtml(moveAt(i)) : ''}</span></div><div class="tl-teams num">${t.c ? COMPS.map((c, k) => `${c.short} ${t.c[k]}`).join(' · ') : 'Components not logged'}</div><div class="tl-teams num">City PPI ${f1(r.city)} · weight ${f1(t.weight)}%</div></li>`;
    }).join('');
    const more = $('tape-more');
    more.hidden = rows.length <= TAPE_SHORT;
    more.textContent = tapeAll ? `Show latest ${TAPE_SHORT} only` : `Show all ${rows.length} official prints`;
  };
  $('tape-more').addEventListener('click', () => { tapeAll = !tapeAll; drawTapeList(); });
  drawTapeList();

  $('foot-data').textContent = `${readings.length} official prints on record · ${cur.version}`;

  // Chart: this team's score, with the citywide reading behind it for reference.
  let range = 0;
  const chartEl = $('chart'), tip = $('tip');
  function drawChart() {
    const pts = range ? readings.filter(r => dayDiff(r.date, cur.date) <= range) : readings;
    const W = chartEl.clientWidth, H = chartEl.clientHeight;
    const m = { l: 34, r: 12, t: 10, b: 22 };
    const t0 = +day(pts[0].date), t1 = +day(pts[pts.length - 1].date);
    const vals = pts.map(score).concat(pts.map(p => p.city));
    const y0 = Math.max(0, Math.floor((Math.min(...vals) - 3) / 5) * 5);
    const y1 = Math.min(100, Math.ceil((Math.max(...vals) + 3) / 5) * 5);
    const x = t => (t1 === t0 ? (W - m.l - m.r) / 2 + m.l : m.l + (t - t0) / (t1 - t0) * (W - m.l - m.r));
    const y = v => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b);
    const step = y1 - y0 > 40 ? 10 : 5;
    let s = '';
    for (let g = y0; g <= y1; g += step) {
      s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(g)}" y2="${y(g)}" stroke="#1c2620"/><text x="${m.l - 6}" y="${y(g) + 4}" text-anchor="end" fill="#808b82" font-size="11">${g}</text>`;
    }
    const line = f => pts.map(p => `${x(+day(p.date)).toFixed(1)},${y(f(p)).toFixed(1)}`).join(' ');
    s += `<polyline fill="none" stroke="#808b82" stroke-width="1.5" stroke-dasharray="3 4" points="${line(p => p.city)}"/>`;
    s += `<polyline fill="none" style="stroke:${team.color}" stroke-width="2" stroke-linejoin="round" points="${line(score)}"/>`;
    const last = pts[pts.length - 1];
    s += `<circle cx="${x(+day(last.date))}" cy="${y(score(last))}" r="4.5" style="fill:${team.color}"/>`;
    const every = Math.max(1, Math.ceil(pts.length / Math.max(2, Math.floor(W / 90))));
    pts.forEach((p, i) => {
      if (i % every === 0 || i === pts.length - 1) {
        if (i !== pts.length - 1 && pts.length - 1 - i < every) return;
        s += `<text x="${x(+day(p.date))}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}" fill="#808b82" font-size="11">${dateShort(p.date)}</text>`;
      }
    });
    const old = chartEl.querySelector('svg');
    if (old) old.remove();
    chartEl.insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 ${W} ${H}" font-family="IBM Plex Mono, Consolas, monospace" role="img" aria-label="${team.name} panic score and the citywide PPI by official print">${s}</svg>`);

    chartEl.onpointermove = e => {
      const box = chartEl.getBoundingClientRect(), px = e.clientX - box.left;
      const near = pts.reduce((a, b) => (Math.abs(x(+day(b.date)) - px) < Math.abs(x(+day(a.date)) - px) ? b : a));
      tip.innerHTML = `${dateLong(near.date)}<br><b style="color:${team.color}">${team.tk} ${f1(score(near))}</b><br><span class="dim">CITY ${f1(near.city)}</span>`;
      tip.style.display = 'block';
      const tx = x(+day(near.date));
      tip.style.left = Math.min(Math.max(4, tx + 10), W - tip.offsetWidth - 4) + 'px';
      tip.style.top = Math.max(0, y(score(near)) - tip.offsetHeight - 8) + 'px';
    };
    chartEl.onpointerdown = chartEl.onpointermove; // a tap shows the reading on touch screens
    chartEl.onpointerleave = () => { tip.style.display = 'none'; };
  }
  $('tabs').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    range = +b.dataset.r;
    $('tabs').querySelectorAll('button').forEach(n => n.classList.toggle('on', n === b));
    drawChart();
  });
  window.addEventListener('resize', drawChart);
  drawChart();
})();
