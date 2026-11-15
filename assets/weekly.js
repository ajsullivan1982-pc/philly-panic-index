// The Weekly Panic Report: one Monday-to-Sunday week of official prints, summarized.
// Every figure comes from the published readings. The commentary is canned and chosen
// by the numbers; nothing here is recalculated or filled in.
(function () {
  const { TEAMS, readings, f1, r1, esc, dir, arrow, moveHtml, day, dateShort, dateLong, todayET } = window.PPI;
  const $ = id => document.getElementById(id);

  if (!readings.length) {
    $('banner').innerHTML = '<div class="banner">NO OFFICIAL PRINTS LOADED. The board stays dark until there is a verified reading.</div>';
    return;
  }

  // Weeks are named by their Monday.
  const iso = d => d.toISOString().slice(0, 10);
  const addDays = (s, n) => { const d = day(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const mondayOf = s => addDays(s, -((day(s).getUTCDay() + 6) % 7));
  const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  const weeks = [];
  readings.forEach((r, i) => {
    const key = mondayOf(r.date);
    let w = weeks[weeks.length - 1];
    if (!w || w.key !== key) { w = { key, rows: [], first: i }; weeks.push(w); }
    w.rows.push(r);
  });
  const today = todayET();
  const done = w => addDays(w.key, 6) < today; // the week's Sunday has passed

  // Default: the latest finished week. ?w=YYYY-MM-DD picks another, by its Monday.
  const asked = new URLSearchParams(location.search).get('w');
  let at = weeks.findIndex(w => w.key === asked);
  if (at < 0) {
    at = weeks.length - 1;
    while (at > 0 && !done(weeks[at])) at--;
  }

  function draw() {
    const w = weeks[at], rows = w.rows;
    const before = w.first > 0 ? readings[w.first - 1] : null; // the last print before this week
    const open = rows[0], close = rows[rows.length - 1];
    const base = before || open;
    const net = r1(close.city - base.city);
    const hi = rows.reduce((a, b) => (b.city > a.city ? b : a));
    const lo = rows.reduce((a, b) => (b.city < a.city ? b : a));
    const range = r1(hi.city - lo.city);
    const live = !done(w);
    const span = `${dateShort(w.key)} – ${dateShort(addDays(w.key, 6))}`;

    $('mast-date').textContent = `WEEK OF ${dateShort(w.key)}`;
    $('mast-span').textContent = `${dateLong(w.key)} to ${dateLong(addDays(w.key, 6))}`;
    $('mast-state').innerHTML = live
      ? '<span class="stale-dot">● WEEK IN PROGRESS</span>'
      : `<span class="live">● ${rows.length} OFFICIAL PRINT${rows.length === 1 ? '' : 'S'}</span>`;
    $('wk-head').textContent = `PPI <Weekly> ${span}`;

    // Week picker
    $('wk-prev').disabled = at === 0;
    $('wk-next').disabled = at === weeks.length - 1;
    $('wk-label').textContent = live ? `${span} · in progress` : span;

    // The week in one line
    const statuses = rows.map(r => r.status).filter((s, i, a) => a.indexOf(s) === i);
    const moveText = dir(net) === 'flat' ? 'unchanged on the week' : `${net > 0 ? 'up' : 'down'} ${f1(Math.abs(net))} on the week`;
    const stay = statuses.length === 1
      ? `spent all ${rows.length} print${rows.length === 1 ? '' : 's'} at ${statuses[0]}`
      : `moved through ${statuses.length} statuses, finishing at ${close.status}`;
    let quip = 'The Desk describes the week as “orderly, for Philadelphia.”';
    if (range >= 15) quip = 'The Desk has asked that nobody call it “volatile.” It was volatile.';
    else if (net >= 5) quip = 'The Desk has stopped asking where the top is.';
    else if (net <= -5) quip = 'A relief rally. Analysts caution against enjoying it.';
    else if (range < 3) quip = 'Analysts describe the market as “stable, in the way a sinkhole is stable.”';
    $('lede').innerHTML = `The city ${live ? 'stands' : 'closed'} at <b>${f1(close.city)}</b>, ${moveText}, and ${stay}. The trading range was ${f1(range)} point${range === 1 ? '' : 's'}. ${esc(quip)}`;
    $('ohlc').innerHTML = [['Open', open.city, ''], ['High', hi.city, ''], ['Low', lo.city, ''], [live ? 'Latest' : 'Close', close.city, dir(net)]]
      .map(([k, v, c]) => `<div><span>${k}</span><b class="num ${c}">${f1(v)}</b></div>`).join('');
    $('basis').textContent = before
      ? `Change is measured from the last print before the week, ${f1(before.city)} on ${dateShort(before.date)}.`
      : 'First week on record. Change is measured from the week’s first print.';

    // The board, and the mover of the week
    const board = TEAMS.map(t => {
      const a = base.teams[t.id].score, b = close.teams[t.id].score;
      return { t, a, b, ch: r1(b - a) };
    }).sort((x, y) => y.b - x.b);
    const mover = board.slice().sort((x, y) => Math.abs(y.ch) - Math.abs(x.ch))[0];
    const mDir = dir(mover.ch);
    const mQuip = mDir === 'down'
      ? 'The biggest move of the week was a decline, which the Desk is treating as a clerical error until proven otherwise.'
      : mDir === 'up' ? 'Nobody on the Desk was surprised.' : 'Nothing moved. The Desk checked twice.';
    $('mover').innerHTML = `<div class="n num ${mDir}">${mover.ch > 0 ? '+' : mover.ch < 0 ? '−' : ''}${f1(Math.abs(mover.ch))}</div>` +
      `<p><a href="${mover.t.id}.html" style="color:${mover.t.color}"><b>${mover.t.tk} · ${mover.t.name}</b></a>, from ${f1(mover.a)} to ${f1(mover.b)}. ${esc(mQuip)}</p>`;
    $('board').innerHTML = `<thead><tr><th>Ticker</th><th>${before ? 'Prior close' : 'Open'}</th><th>${live ? 'Latest' : 'Close'}</th><th>Week chg</th></tr></thead><tbody>` +
      board.map(x => `<tr><td class="tk"><a href="${x.t.id}.html" style="color:${x.t.color}">${x.t.tk}<small>${x.t.name}</small></a></td><td class="num">${f1(x.a)}</td><td class="score num" style="color:${x.t.color}">${f1(x.b)}</td><td class="num">${moveHtml(x.ch)}</td></tr>`).join('') + '</tbody>';

    // The week's headlines: each print's primary driver, in order.
    $('heads').innerHTML = rows.map(r =>
      `<li><span class="k">${DAYS[day(r.date).getUTCDay()]} ${dateShort(r.date)} · PPI ${f1(r.city)} ${moveHtml(r.move)} · ${esc(r.status)}</span>${esc(r.driver)}</li>`).join('');

    $('foot-data').textContent = `${readings.length} official prints on record · ${close.version}`;
    history.replaceState(null, '', at === defaultAt ? location.pathname : `?w=${w.key}`);
  }

  const defaultAt = (() => { let i = weeks.length - 1; while (i > 0 && !done(weeks[i])) i--; return i; })();
  $('wk-prev').addEventListener('click', () => { if (at > 0) { at--; draw(); } });
  $('wk-next').addEventListener('click', () => { if (at < weeks.length - 1) { at++; draw(); } });

  // Share: the phone's share sheet where there is one, otherwise a prefilled post on X.
  $('share-week').addEventListener('click', () => {
    const w = weeks[at], close = w.rows[w.rows.length - 1];
    const base = w.first > 0 ? readings[w.first - 1] : w.rows[0];
    const net = r1(close.city - base.city);
    const text = `Weekly Panic Report, week of ${dateShort(w.key)}: PPI ${f1(close.city)} (${dir(net) === 'flat' ? 'unch' : arrow(net) + f1(Math.abs(net))} on the week), ${close.status}. via @phlpanicindex`;
    const url = `https://phillypanic.com/weekly.html?w=${w.key}`;
    try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: 'share-weekly', title: 'share-weekly', event: true }); } catch (e) { /* never block a share */ }
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) { navigator.share({ text, url }).catch(() => {}); return; }
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener');
  });

  draw();
})();
