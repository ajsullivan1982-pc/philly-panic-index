(function () {
  const { TEAMS, COMPS, BANDS, readings, bandIndex, f1, r1, esc, tps, dir, arrow, moveHtml, day, dayDiff, dateShort, dateLong, todayET } = window.PPI;
  const $ = id => document.getElementById(id);

  if (!readings.length) {
    $('banner').innerHTML = '<div class="banner">NO OFFICIAL PRINTS LOADED. The board stays dark until there is a verified reading.</div>';
    return;
  }

  const cur = readings[readings.length - 1];
  const prev = readings.length > 1 ? readings[readings.length - 2] : null;
  const teamMove = t => (prev ? r1(cur.teams[t.id].score - prev.teams[t.id].score) : 0);
  const contrib = t => cur.teams[t.id].score * cur.teams[t.id].weight / 100;
  const totalContrib = TEAMS.reduce((s, t) => s + contrib(t), 0);
  const byWeight = TEAMS.slice().sort((a, b) => cur.teams[b.id].weight - cur.teams[a.id].weight);
  const band = bandIndex(cur.status);
  const sev = band >= 0 ? BANDS[band].sev : 2;

  // Masthead and freshness
  const today = todayET();
  const age = dayDiff(cur.date, today);
  const runTime = (cur.run.match(/(\d{2}):(\d{2}) ET$/) || []);
  const opening = runTime[1] === '05' && runTime[2] === '00';
  $('mast-date').textContent = dateLong(cur.date);
  $('mast-session').textContent = opening ? 'OPENING PANIC · 5:00 AM ET' : `INTRADAY PANIC · ${runTime[1]}:${runTime[2]} ET`;
  $('mast-state').innerHTML = age <= 0
    ? '<span class="live">● TODAY\'S OFFICIAL PRINT</span>'
    : `<span class="stale-dot">● LAST OFFICIAL PRINT · ${age} DAY${age === 1 ? '' : 'S'} AGO</span>`;
  if (age > 0) {
    $('banner').innerHTML = `<div class="banner">NO OFFICIAL PRINT ON THE BOARD FOR ${dateLong(today)}. Showing the last official reading, ${dateLong(cur.date)}. We do not carry numbers forward or make them up. Only the jokes.</div>`;
  }

  // Ticker
  const tick = [`<span class="item"><span class="am">PPI ${f1(cur.city)}</span> ${moveHtml(cur.move)}</span>`]
    .concat(byWeight.map(t => `<span class="item">${t.tk} ${f1(cur.teams[t.id].score)} ${moveHtml(teamMove(t))}</span>`))
    .concat([`<span class="item am">STATUS: ${esc(cur.status)}</span>`, `<span class="item dim">${dateShort(cur.date)} PRINT</span>`])
    .join('');
  $('ticker').innerHTML = tick.repeat(6);

  // Hero
  $('city').textContent = f1(cur.city);
  const pct = prev ? (cur.move / prev.city) * 100 : 0;
  $('move').innerHTML = `<span class="${dir(cur.move)}">${arrow(cur.move)} ${f1(Math.abs(cur.move))}<small>${cur.move > 0 ? '+' : cur.move < 0 ? '−' : ''}${Math.abs(pct).toFixed(2)}% vs prior print</small></span>`;
  $('status-chip').innerHTML = `<span class="status-chip sev-${sev}">${esc(cur.status)}</span>`;

  // Audit: recompute to validate, never to replace.
  const teamsOk = TEAMS.filter(t => Math.abs(tps(cur.teams[t.id].c) - cur.teams[t.id].score) <= 0.051).length;
  const wSum = TEAMS.reduce((s, t) => s + cur.teams[t.id].weight, 0);
  const cityRaw = TEAMS.reduce((s, t) => s + tps(cur.teams[t.id].c) * cur.teams[t.id].weight / 100, 0);
  const cityOk = Math.abs(cityRaw - cur.city) <= 0.051 || Math.abs(totalContrib - cur.city) <= 0.051;
  $('audit').innerHTML = (teamsOk === 4 && cityOk && Math.abs(wSum - 100) < 0.01)
    ? `<b>AUDIT ✓</b> 24 of 24 components reconcile to four team scores. Weights sum to 100%. City reading reconciles to ${cityRaw.toFixed(3)}.`
    : `<b class="bad">AUDIT ⚠︎</b> The direct weighted result is ${f1(cityRaw)} (${teamsOk} of 4 team scores reconcile, weights sum to ${f1(wSum)}%). A citywide control or correction may apply. The logged reading is shown as published.`;

  // Status ladder and driver
  $('ladder').innerHTML = BANDS.slice().reverse().map(b =>
    `<li class="sev-${b.sev}${BANDS.indexOf(b) === band ? ' on' : ''}"><span class="rng">${b.range}</span><span>${b.name}</span></li>`).join('');
  $('driver').textContent = cur.driver;

  // Team table
  const spark = t => {
    const v = readings.map(r => r.teams[t.id].score);
    const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
    const pts = v.map((y, i) => `${(v.length > 1 ? i / (v.length - 1) : 0.5) * 86 + 2},${20 - ((y - lo) / span) * 16}`).join(' ');
    return `<svg width="90" height="24" viewBox="0 0 90 24" role="img" aria-label="${t.name} trend"><polyline fill="none" stroke="${t.color}" stroke-width="1.5" points="${pts}"/></svg>`;
  };
  const rating = (t) => {
    const s = cur.teams[t.id].score, m = teamMove(t);
    if (m >= 0.05) return ['PANIC: UPGRADE', 'up'];
    if (m <= -0.05) return ['REDUCE PANIC', 'down'];
    if (s >= 90) return ['HOLD MAX PANIC', 'up'];
    if (s < 35) return ['UNDERWEIGHT PANIC', 'down'];
    return ['HOLD PANIC', 'am'];
  };
  $('team-table').innerHTML =
    `<thead><tr><th>Ticker</th><th>TPS</th><th>Chg</th>${COMPS.map(c => `<th class="heat" title="${c.name}, ${c.w * 100}% of team score">${c.short}</th>`).join('')}<th>City wt</th><th>Contrib</th><th>Trend</th><th class="l">Desk rating</th><th><span class="sr">Share</span></th></tr></thead><tbody>` +
    byWeight.map(t => {
      const d = cur.teams[t.id], p = prev && prev.teams[t.id].c ? prev.teams[t.id] : null;
      const cells = d.c.map((v, i) => {
        const ch = p ? v - p.c[i] : 0;
        const mark = ch > 0 ? ' ▲' : ch < 0 ? ' ▼' : '';
        return `<td class="heat num" style="background:rgba(255,61,82,${(v / 100 * 0.8).toFixed(2)})" title="${COMPS[i].name}: ${v}${p ? ` (${ch >= 0 ? '+' : ''}${ch} vs prior print)` : ''}">${v}${mark}</td>`;
      }).join('');
      const [label, cls] = rating(t);
      return `<tr><td class="tk" style="color:${t.color}">${t.tk}<small>${t.name}</small></td><td class="score num" style="color:${t.color}">${f1(d.score)}</td><td class="num">${moveHtml(teamMove(t))}</td>${cells}<td class="num">${f1(d.weight)}%</td><td class="num">${contrib(t).toFixed(2)}</td><td>${spark(t)}</td><td class="l"><span class="rating ${cls}" style="margin:0">${label}</span></td><td><button type="button" class="share" data-share="${t.id}" aria-label="Share the ${t.name} reading">Share</button></td></tr>`;
    }).join('') + '</tbody>';

  // The same team data as cards, for screens too narrow for the table.
  $('team-cards').innerHTML = byWeight.map(t => {
    const d = cur.teams[t.id], p = prev && prev.teams[t.id].c ? prev.teams[t.id] : null;
    const [label, cls] = rating(t);
    const comps = d.c.map((v, i) => {
      const ch = p ? v - p.c[i] : 0;
      return `<div class="heat" style="background:rgba(255,61,82,${(v / 100 * 0.8).toFixed(2)})"><span>${COMPS[i].short}</span><b class="num">${v}${ch > 0 ? ' ▲' : ch < 0 ? ' ▼' : ''}</b></div>`;
    }).join('');
    return `<article class="tcard" style="border-left-color:${t.color}">
      <div class="tcard-top"><div class="tk" style="color:${t.color}">${t.tk}<small>${t.name}</small></div><div class="score num" style="color:${t.color}">${f1(d.score)}</div><div class="num">${moveHtml(teamMove(t))}</div></div>
      <div class="tcard-comps">${comps}</div>
      <div class="tcard-foot"><span class="dim num">City wt ${f1(d.weight)}% · Contrib ${contrib(t).toFixed(2)}</span><span class="rating ${cls}" style="margin:0">${label}</span></div>
      <button type="button" class="share" data-share="${t.id}">Share ${t.tk}</button>
    </article>`;
  }).join('');

  // Sharing: the phone's share sheet where there is one, otherwise a prefilled post on X.
  const SITE = 'https://phillypanic.com/';
  const signed = d => (dir(d) === 'flat' ? 'unch' : `${arrow(d)}${f1(Math.abs(d))}`);
  const share = text => {
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      navigator.share({ text, url: SITE }).catch(() => {});
      return;
    }
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SITE)}`, '_blank', 'noopener');
  };
  $('share-city').addEventListener('click', () =>
    share(`Philly Panic Index: ${f1(cur.city)} (${signed(cur.move)}) · ${cur.status} · ${dateShort(cur.date)} official print. via @phlpanicindex`));
  $('teams').addEventListener('click', e => {
    const b = e.target.closest('button[data-share]');
    if (!b) return;
    const t = TEAMS.find(x => x.id === b.dataset.share);
    share(`${t.tk} ${f1(cur.teams[t.id].score)} (${signed(teamMove(t))}): ${t.name} panic, ${dateShort(cur.date)} official print. Citywide PPI ${f1(cur.city)}, ${cur.status}. via @phlpanicindex`);
  });

  // Attribution
  $('stack').innerHTML = byWeight.map(t => {
    const share = contrib(t) / totalContrib * 100;
    return `<div style="width:${share}%;background:${t.color}" title="${t.name}: ${share.toFixed(1)}%">${share >= 8 ? t.tk : ''}</div>`;
  }).join('');
  $('legend').innerHTML = byWeight.map(t =>
    `<div><i style="background:${t.color}"></i><b>${t.name}</b><br><span class="dim num">${contrib(t).toFixed(2)} pts · ${(contrib(t) / totalContrib * 100).toFixed(1)}% of total</span></div>`).join('');

  // Desk notes: every figure is computed from the log. The commentary is not.
  const notes = [];
  const top = TEAMS.slice().sort((a, b) => contrib(b) - contrib(a))[0];
  notes.push(['Concentration risk', `The ${top.name} account for ${(contrib(top) / totalContrib * 100).toFixed(1)}% of all panic currently in circulation. Diversification remains unavailable in this market.`]);

  if (band >= 0) {
    const up = BANDS[band + 1];
    const above = r1(cur.city - BANDS[band].lo);
    let s = up
      ? `The city sits ${f1(up.lo - cur.city)} points below ${up.name} (${up.lo}) and ${f1(above)} above the ${BANDS[band].name} floor (${BANDS[band].lo}).`
      : `The city is in ${BANDS[band].name}, the highest band published. There is no resistance level above this one.`;
    if (up && up.lo - cur.city <= 1) s += ' The desk is watching the door.';
    notes.push(['Technicals', s]);
  }

  const all = [];
  TEAMS.forEach(t => cur.teams[t.id].c.forEach((v, i) => all.push({ t, v, comp: COMPS[i] })));
  const maxed = all.filter(x => x.v >= 100);
  if (maxed.length) {
    notes.push(['Ceiling watch', `${maxed.length} of 24 components are at 100: ${maxed.map(x => `${x.t.name} ${x.comp.name}`).join(', ')}. The scale does not go higher. We checked.`]);
  }
  const low = all.slice().sort((a, b) => a.v - b.v)[0];
  notes.push(['Floor watch', `Calmest reading on the board: ${low.t.name} ${low.comp.name}, ${low.v}. Analysts describe it as “suspicious.”`]);

  let streak = 1;
  for (let i = readings.length - 2; i >= 0 && readings[i].status === cur.status; i--) streak++;
  const hi = readings.reduce((a, b) => (b.city > a.city ? b : a));
  const lo = readings.reduce((a, b) => (b.city < a.city ? b : a));
  notes.push(['The record', `${streak > 1 ? `${streak} consecutive logged prints at ${cur.status}. ` : `First logged print at ${cur.status} after a change of status. `}Range on record: high ${f1(hi.city)} (${dateShort(hi.date)}), low ${f1(lo.city)} (${dateShort(lo.date)}), across ${readings.length} official prints.`]);

  const teamNote = t => {
    const d = cur.teams[t.id], m = teamMove(t);
    const at100 = d.c.map((v, i) => (v >= 100 ? COMPS[i].name : null)).filter(Boolean);
    const topI = d.c.indexOf(Math.max(...d.c));
    if (m >= 2) return `Up ${f1(m)} since the prior print, to ${f1(d.score)}. The desk describes the move as “orderly, for Philadelphia.”`;
    if (m <= -2) return `Down ${f1(-m)} since the prior print, to ${f1(d.score)}. A relief rally. Analysts caution against enjoying it.`;
    if (at100.length) return `${at100.length === 1 ? `${at100[0]} is` : `${at100.length} components are`} pinned at 100. Further deterioration cannot be priced.`;
    if (d.c[2] <= 10) return `Stakes at ${d.c[2]}. It is the offseason. The panic is priced in.`;
    if (d.score < 35) return `Trading at ${f1(d.score)}. Suspiciously calm. The desk recommends remaining suspicious.`;
    if (dir(m) === 'flat') return `Unchanged at ${f1(d.score)}. No news is not good news. It is merely no news.`;
    return `${f1(d.score)}, ${m > 0 ? 'up' : 'down'} ${f1(Math.abs(m))}. Largest exposure: ${COMPS[topI].name} at ${d.c[topI]}.`;
  };
  byWeight.forEach(t => {
    const [label, cls] = rating(t);
    notes.push([`${t.tk} · ${t.name} <span class="rating ${cls}">${label}</span>`, teamNote(t)]);
  });
  $('notes').innerHTML = notes.map(([k, body]) => `<li><span class="k">${k}</span>${esc(body)}</li>`).join('');

  // Tape
  $('tape-table').innerHTML =
    `<thead><tr><th>Print</th><th>PPI</th><th>Chg</th><th class="l">Status</th>${TEAMS.map(t => `<th>${t.tk}</th>`).join('')}<th class="l">Primary panic driver</th></tr></thead><tbody>` +
    readings.slice().reverse().map((r, i) => {
      const b = bandIndex(r.status);
      return `<tr class="${i === 0 ? 'cur' : ''}"><td>${dateLong(r.date)}</td><td class="num"><b>${f1(r.city)}</b></td><td class="num">${moveHtml(r.move)}</td><td class="l sev-${b >= 0 ? BANDS[b].sev : 2}">${esc(r.status)}</td>${TEAMS.map(t => `<td class="num">${f1(r.teams[t.id].score)}</td>`).join('')}<td class="wrap-cell">${esc(r.driver)}</td></tr>`;
    }).join('') + '</tbody>';

  // The tape as a list for narrow screens: latest ten, the rest on request.
  const TAPE_SHORT = 10;
  let tapeAll = false;
  const drawTapeList = () => {
    const rows = readings.slice().reverse();
    $('tape-list').innerHTML = (tapeAll ? rows : rows.slice(0, TAPE_SHORT)).map((r, i) => {
      const b = bandIndex(r.status);
      return `<li class="${i === 0 ? 'cur' : ''}"><div class="tl-top"><span>${dateLong(r.date)}</span><b class="num">${f1(r.city)}</b><span class="num">${moveHtml(r.move)}</span></div><div class="tl-status sev-${b >= 0 ? BANDS[b].sev : 2}">${esc(r.status)}</div><div class="tl-teams num">${TEAMS.map(t => `${t.tk} ${f1(r.teams[t.id].score)}`).join(' · ')}</div><p>${esc(r.driver)}</p></li>`;
    }).join('');
    const more = $('tape-more');
    more.hidden = rows.length <= TAPE_SHORT;
    more.textContent = tapeAll ? `Show latest ${TAPE_SHORT} only` : `Show all ${rows.length} official prints`;
  };
  $('tape-more').addEventListener('click', () => { tapeAll = !tapeAll; drawTapeList(); });
  drawTapeList();

  $('foot-data').textContent = `${readings.length} official prints on record · ${cur.version}`;

  // Chart
  let range = 0, showTeams = false;
  const chartEl = $('chart'), tip = $('tip');
  function drawChart() {
    const pts = range ? readings.filter(r => dayDiff(r.date, cur.date) <= range) : readings;
    const W = chartEl.clientWidth, H = chartEl.clientHeight;
    const m = { l: 34, r: 12, t: 10, b: 22 };
    const t0 = +day(pts[0].date), t1 = +day(pts[pts.length - 1].date);
    const vals = pts.map(p => p.city);
    if (showTeams) pts.forEach(p => TEAMS.forEach(t => vals.push(p.teams[t.id].score)));
    let y0 = Math.max(0, Math.floor((Math.min(...vals) - 3) / 5) * 5);
    let y1 = Math.min(100, Math.ceil((Math.max(...vals) + 3) / 5) * 5);
    const x = t => (t1 === t0 ? (W - m.l - m.r) / 2 + m.l : m.l + (t - t0) / (t1 - t0) * (W - m.l - m.r));
    const y = v => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b);
    const step = y1 - y0 > 40 ? 10 : 5;
    let s = '';
    for (let g = y0; g <= y1; g += step) {
      s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(g)}" y2="${y(g)}" stroke="#1c2620"/><text x="${m.l - 6}" y="${y(g) + 4}" text-anchor="end" fill="#808b82" font-size="11">${g}</text>`;
    }
    BANDS.forEach(b => {
      // The bands describe the citywide reading, so they come off when team lines go on.
      if (!showTeams && b.lo > y0 && b.lo < y1) {
        s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(b.lo)}" y2="${y(b.lo)}" stroke="#ffb000" stroke-dasharray="4 4" opacity="0.7"/><text x="${m.l + 6}" y="${y(b.lo) - 5}" fill="#ffb000" font-size="10">${b.name} ${b.lo}</text>`;
      }
    });
    if (showTeams) {
      TEAMS.forEach(t => {
        const line = pts.map(p => `${x(+day(p.date)).toFixed(1)},${y(p.teams[t.id].score).toFixed(1)}`).join(' ');
        s += `<polyline fill="none" style="stroke:${t.color}" stroke-width="1.5" stroke-linejoin="round" opacity="0.9" points="${line}"/>`;
      });
    }
    for (let i = 1; i < pts.length; i++) {
      const gap = dayDiff(pts[i - 1].date, pts[i].date) > 1;
      s += `<line x1="${x(+day(pts[i - 1].date))}" y1="${y(pts[i - 1].city)}" x2="${x(+day(pts[i].date))}" y2="${y(pts[i].city)}" stroke="${gap ? '#808b82' : '#3dff5c'}" stroke-width="${gap ? 1 : 2}" ${gap ? 'stroke-dasharray="2 4"' : ''}/>`;
    }
    pts.forEach((p, i) => {
      if (showTeams && i !== pts.length - 1) return;
      s += `<circle cx="${x(+day(p.date))}" cy="${y(p.city)}" r="${i === pts.length - 1 ? 4.5 : 3}" fill="${i === pts.length - 1 ? '#ff3d52' : '#3dff5c'}"/>`;
    });
    const every = Math.max(1, Math.ceil(pts.length / Math.max(2, Math.floor(W / 90))));
    pts.forEach((p, i) => {
      if (i % every === 0 || i === pts.length - 1) {
        if (i !== pts.length - 1 && pts.length - 1 - i < every) return;
        const px = x(+day(p.date));
        s += `<text x="${px}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}" fill="#808b82" font-size="11">${dateShort(p.date)}</text>`;
      }
    });
    const old = chartEl.querySelector('svg');
    if (old) old.remove();
    chartEl.insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 ${W} ${H}" font-family="IBM Plex Mono, Consolas, monospace" role="img" aria-label="${showTeams ? 'Citywide PPI and the four team panic scores' : 'Citywide PPI'} by official print">${s}</svg>`);
    $('chart-label').textContent = showTeams ? 'Citywide PPI and team scores, official prints' : 'Citywide PPI, official prints';
    $('chart-legend').innerHTML = showTeams
      ? `<span><i style="background:var(--green)"></i>CITY</span>` + TEAMS.map(t => `<span><i style="background:${t.color}"></i>${t.tk}</span>`).join('')
      : '';

    chartEl.onpointermove = e => {
      const box = chartEl.getBoundingClientRect(), px = e.clientX - box.left;
      const near = pts.reduce((a, b) => (Math.abs(x(+day(b.date)) - px) < Math.abs(x(+day(a.date)) - px) ? b : a));
      tip.innerHTML = `${dateLong(near.date)}<br><b>${f1(near.city)}</b> ${moveHtml(near.move)}<br>${esc(near.status)}` +
        (showTeams ? '<br>' + TEAMS.map(t => `<span style="color:${t.color}">${t.tk} ${f1(near.teams[t.id].score)}</span>`).join('<br>') : '');
      tip.style.display = 'block';
      const tx = x(+day(near.date));
      tip.style.left = Math.min(Math.max(4, tx + 10), W - tip.offsetWidth - 4) + 'px';
      tip.style.top = Math.max(0, y(near.city) - tip.offsetHeight - 8) + 'px';
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
  $('teams-toggle').addEventListener('click', e => {
    showTeams = !showTeams;
    e.currentTarget.classList.toggle('on', showTeams);
    e.currentTarget.setAttribute('aria-pressed', showTeams);
    e.currentTarget.textContent = showTeams ? '− TEAMS' : '+ TEAMS';
    drawChart();
  });
  window.addEventListener('resize', drawChart);
  drawChart();
})();
