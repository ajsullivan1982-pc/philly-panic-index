// The Weekly Panic Report: one Monday-to-Sunday week of official prints, summarized.
// Every figure comes from the published readings. The commentary is canned and chosen
// by the numbers; nothing here is recalculated or filled in.
// The same summary feeds the page and the email edition (weekly.html?email=1).
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
  const params = new URLSearchParams(location.search);
  const asked = params.get('w');
  const emailMode = params.has('email'); // the Desk's copy-for-email panel
  let at = weeks.findIndex(w => w.key === asked);
  if (at < 0) {
    at = weeks.length - 1;
    while (at > 0 && !done(weeks[at])) at--;
  }

  // Everything the page and the email say about one week.
  function summarize(w) {
    const rows = w.rows;
    const before = w.first > 0 ? readings[w.first - 1] : null; // the last print before this week
    const open = rows[0], close = rows[rows.length - 1];
    const base = before || open;
    const net = r1(close.city - base.city);
    const hi = rows.reduce((a, b) => (b.city > a.city ? b : a));
    const lo = rows.reduce((a, b) => (b.city < a.city ? b : a));
    const range = r1(hi.city - lo.city);
    const live = !done(w);
    const span = `${dateShort(w.key)} – ${dateShort(addDays(w.key, 6))}`;

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
    // The one-line summary, with the closing number wrapped in whichever tag the caller wants.
    const lede = tag => `The city ${live ? 'stands' : 'closed'} at <${tag}>${f1(close.city)}</${tag}>, ${moveText}, and ${esc(stay)}. The trading range was ${f1(range)} point${range === 1 ? '' : 's'}. ${esc(quip)}`;
    const basis = before
      ? `Change is measured from the last print before the week, ${f1(before.city)} on ${dateShort(before.date)}.`
      : 'First week on record. Change is measured from the week’s first print.';

    const board = TEAMS.map(t => {
      const a = base.teams[t.id].score, b = close.teams[t.id].score;
      return { t, a, b, ch: r1(b - a) };
    }).sort((x, y) => y.b - x.b);
    const mover = board.slice().sort((x, y) => Math.abs(y.ch) - Math.abs(x.ch))[0];
    const mDir = dir(mover.ch);
    const mQuip = mDir === 'down'
      ? 'The biggest move of the week was a decline, which the Desk is treating as a clerical error until proven otherwise.'
      : mDir === 'up' ? 'Nobody on the Desk was surprised.' : 'Nothing moved. The Desk checked twice.';
    const mSigned = `${mover.ch > 0 ? '+' : mover.ch < 0 ? '−' : ''}${f1(Math.abs(mover.ch))}`;

    return { w, rows, before, open, close, net, hi, lo, range, live, span, moveText, lede, basis, board, mover, mDir, mQuip, mSigned };
  }

  function draw() {
    const s = summarize(weeks[at]);
    const { w, rows, before, open, close, net, hi, lo, live, span, board, mover, mDir } = s;

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
    $('lede').innerHTML = s.lede('b');
    $('ohlc').innerHTML = [['Open', open.city, ''], ['High', hi.city, ''], ['Low', lo.city, ''], [live ? 'Latest' : 'Close', close.city, dir(net)]]
      .map(([k, v, c]) => `<div><span>${k}</span><b class="num ${c}">${f1(v)}</b></div>`).join('');
    $('basis').textContent = s.basis;

    // The board, and the mover of the week
    $('mover').innerHTML = `<div class="n num ${mDir}">${s.mSigned}</div>` +
      `<p><a href="${mover.t.id}.html" style="color:${mover.t.color}"><b>${mover.t.tk} · ${mover.t.name}</b></a>, from ${f1(mover.a)} to ${f1(mover.b)}. ${esc(s.mQuip)}</p>`;
    $('board').innerHTML = `<thead><tr><th>Ticker</th><th>${before ? 'Prior close' : 'Open'}</th><th>${live ? 'Latest' : 'Close'}</th><th>Week chg</th></tr></thead><tbody>` +
      board.map(x => `<tr><td class="tk"><a href="${x.t.id}.html" style="color:${x.t.color}">${x.t.tk}<small>${x.t.name}</small></a></td><td class="num">${f1(x.a)}</td><td class="score num" style="color:${x.t.color}">${f1(x.b)}</td><td class="num">${moveHtml(x.ch)}</td></tr>`).join('') + '</tbody>';

    // The week's headlines: each print's primary driver, in order.
    $('heads').innerHTML = rows.map(r =>
      `<li><span class="k">${DAYS[day(r.date).getUTCDay()]} ${dateShort(r.date)} · PPI ${f1(r.city)} ${moveHtml(r.move)} · ${esc(r.status)}</span>${esc(r.driver)}</li>`).join('');

    $('foot-data').textContent = `${readings.length} official prints on record · ${close.version}`;
    const q = new URLSearchParams();
    if (at !== defaultAt) q.set('w', w.key);
    if (emailMode) q.set('email', '1');
    history.replaceState(null, '', q.toString() ? `?${q}` : location.pathname);

    if (emailMode) drawEmail(s);
  }

  // ---- Email edition -------------------------------------------------------------------
  // The computed sections as plain, email-safe HTML: headings, paragraphs, two tables.
  // Colours are written out because an email cannot read the site's stylesheet.
  const HEX = { up: '#ff3d52', down: '#3dff5c', flat: '#808b82', eagles: '#2fd6b5', phillies: '#ff3d52', sixers: '#3f86ff', flyers: '#ff7a1a' };
  const tint = (hex, html) => `<span style="color: ${hex}">${html}</span>`;
  const mv = d => tint(HEX[dir(d)], `${arrow(d)} ${f1(Math.abs(d))}`);

  function emailParts(s) {
    const { w, rows, before, open, close, net, hi, lo, live, board, mover } = s;
    const cell = v => `<td><p>${v}</p></td>`, head = v => `<th><p>${v}</p></th>`;
    const html = [
      `<p><strong>${tint('#3dff5c', `WEEK OF ${s.span}`)}</strong> · ${rows.length} official print${rows.length === 1 ? '' : 's'}${live ? ' so far' : ''}</p>`,
      '<h2>THE WEEK IN ONE LINE</h2>',
      `<p>${s.lede('strong')}</p>`,
      `<table><tbody><tr>${['Open', 'High', 'Low', live ? 'Latest' : 'Close'].map(head).join('')}</tr>` +
        `<tr>${[f1(open.city), f1(hi.city), f1(lo.city), `<strong>${tint(HEX[dir(net)], f1(close.city))}</strong>`].map(cell).join('')}</tr></tbody></table>`,
      `<p><em>${esc(s.basis)}</em></p>`,
      '<h2>MOVER OF THE WEEK</h2>',
      `<p><strong>${tint(HEX[mover.t.id], `${mover.t.tk} · ${mover.t.name}`)} ${tint(HEX[s.mDir], s.mSigned)}</strong>, from ${f1(mover.a)} to ${f1(mover.b)}. ${esc(s.mQuip)}</p>`,
      '<h2>THE BOARD, WEEK OVER WEEK</h2>',
      `<table><tbody><tr>${['Ticker', before ? 'Prior close' : 'Open', live ? 'Latest' : 'Close', 'Week chg'].map(head).join('')}</tr>` +
        board.map(x => `<tr>${[`<strong>${tint(HEX[x.t.id], x.t.tk)}</strong> ${x.t.name}`, f1(x.a), `<strong>${f1(x.b)}</strong>`, mv(x.ch)].map(cell).join('')}</tr>`).join('') + '</tbody></table>',
      '<h2>THE WEEK’S HEADLINES</h2>',
      rows.map(r => `<p><strong>${DAYS[day(r.date).getUTCDay()]} ${dateShort(r.date)} · PPI ${f1(r.city)} ${mv(r.move)} · ${esc(r.status)}</strong><br>${esc(r.driver)}</p>`).join(''),
      `<p><a href="https://phillypanic.com/weekly.html?w=${w.key}">Read this report on phillypanic.com</a></p>`
    ].join('');
    const subject = `Weekly Panic Report: PPI ${f1(close.city)}, ${s.moveText}`;
    const preview = `${close.status}. Mover of the week: ${mover.t.name} ${s.mSigned.replace('−', '-')}. Week of ${dateShort(w.key)}.`;
    return { html, subject, preview };
  }

  const toText = html => {
    const t = document.createElement('textarea');
    t.innerHTML = html.replace(/<\/t[hd]>/g, '\t').replace(/<\/(p|h2|tr)>|<br>/g, '\n').replace(/<[^>]+>/g, '');
    return t.value.replace(/\t\n/g, '\n').replace(/\n{2,}/g, '\n\n').trim();
  };

  let mail = null;
  function drawEmail(s) {
    mail = emailParts(s);
    $('email-panel').hidden = false;
    $('em-subject').textContent = mail.subject;
    $('em-preview').textContent = mail.preview;
    $('em-body').innerHTML = mail.html;
    $('em-warn').hidden = !s.live;
  }

  async function copy(btn, text, html) {
    const label = btn.textContent;
    let ok = false;
    try {
      if (html && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' })
        })]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      ok = true;
    } catch (e) { /* fall through to the message below */ }
    btn.textContent = ok ? 'Copied' : 'Could not copy. Select the text below instead.';
    setTimeout(() => { btn.textContent = label; }, ok ? 1500 : 4000);
  }

  if (emailMode) {
    $('em-copy-subject').addEventListener('click', e => copy(e.currentTarget, mail.subject));
    $('em-copy-preview').addEventListener('click', e => copy(e.currentTarget, mail.preview));
    $('em-copy-body').addEventListener('click', e => copy(e.currentTarget, toText(mail.html), mail.html));
  }
  window.PPI_WEEKLY_EMAIL = () => emailParts(summarize(weeks[at])); // for a draft made outside the page

  const defaultAt = (() => { let i = weeks.length - 1; while (i > 0 && !done(weeks[i])) i--; return i; })();
  $('wk-prev').addEventListener('click', () => { if (at > 0) { at--; draw(); } });
  $('wk-next').addEventListener('click', () => { if (at < weeks.length - 1) { at++; draw(); } });

  // Share: the phone's share sheet where there is one, otherwise a prefilled post on X.
  $('share-week').addEventListener('click', () => {
    const { w, close, net } = summarize(weeks[at]);
    const text = `Weekly Panic Report, week of ${dateShort(w.key)}: PPI ${f1(close.city)} (${dir(net) === 'flat' ? 'unch' : arrow(net) + f1(Math.abs(net))} on the week), ${close.status}. via @phlpanicindex`;
    const url = `https://phillypanic.com/weekly.html?w=${w.key}`;
    try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: 'share-weekly', title: 'share-weekly', event: true }); } catch (e) { /* never block a share */ }
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) { navigator.share({ text, url }).catch(() => {}); return; }
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener');
  });

  draw();
})();
