// Shared constants and helpers for the homepage, the methodology page, the team pages and the weekly report.
window.PPI = (function () {
  const TEAMS = [
    { id: 'eagles', name: 'Eagles', tk: 'BRDS', color: 'var(--eagles)' },
    { id: 'phillies', name: 'Phillies', tk: 'PHLS', color: 'var(--phillies)' },
    { id: 'sixers', name: 'Sixers', tk: 'SIXR', color: 'var(--sixers)' },
    { id: 'flyers', name: 'Flyers', tk: 'FLYR', color: 'var(--flyers)' }
  ];

  // Component order and weights, Methodology v1.2.
  const COMPS = [
    { name: 'Performance', short: 'PERF', w: 0.30 },
    { name: 'Expectations vs Reality', short: 'EXPT', w: 0.20 },
    { name: 'Stakes', short: 'STKS', w: 0.15 },
    { name: 'Injuries & Roster News', short: 'INJ', w: 0.15 },
    { name: 'Fan & Media Sentiment', short: 'SENT', w: 0.10 },
    { name: 'Historical Trauma', short: 'TRMA', w: 0.10 }
  ];

  // Published ranges. The status shown for a reading is always the logged one;
  // these are used for the ladder and for chart reference lines only.
  const BANDS = [
    { lo: 0, range: '0–19', name: 'PARADE CONDITIONS', sev: 0 },
    { lo: 20, range: '20–34', name: "WE'RE FINE", sev: 0 },
    { lo: 35, range: '35–49', name: 'RESTLESS', sev: 1 },
    { lo: 50, range: '50–64', name: 'CONCERNED', sev: 1 },
    { lo: 65, range: '65–79', name: 'HIGH ANXIETY', sev: 2 },
    { lo: 80, range: '80–89', name: 'WOODER BOILING', sev: 2 },
    { lo: 90, range: '90–97', name: 'FIRE EVERYBODY', sev: 2 },
    { lo: 98, range: '98–100', name: 'CIVIC EMERGENCY', sev: 2 }
  ];

  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  const normStatus = s => String(s).toUpperCase().replace(/[‘’]/g, "'").trim();
  const bandIndex = status => BANDS.findIndex(b => b.name === normStatus(status));
  const f1 = n => (Math.round(n * 10) / 10).toFixed(1);
  const r1 = n => Math.round(n * 10) / 10;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tps = c => COMPS.reduce((sum, comp, i) => sum + comp.w * c[i], 0);
  const dir = d => (d > 0.04 ? 'up' : d < -0.04 ? 'down' : 'flat');
  const arrow = d => ({ up: '▲', down: '▼', flat: '→' }[dir(d)]);
  const moveHtml = d => `<span class="${dir(d)}">${arrow(d)} ${f1(Math.abs(d))}</span>`;
  const day = iso => new Date(iso + 'T12:00:00Z');
  const dayDiff = (a, b) => Math.round((day(b) - day(a)) / 864e5);
  const dateShort = iso => { const d = day(iso); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`; };
  const dateLong = iso => `${dateShort(iso)}, ${day(iso).getUTCFullYear()}`;
  const todayET = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

  const readings = ((window.PPI_DATA && window.PPI_DATA.readings) || []).slice().sort((a, b) => a.run < b.run ? -1 : 1);

  return { TEAMS, COMPS, BANDS, readings, normStatus, bandIndex, f1, r1, esc, tps, dir, arrow, moveHtml, day, dayDiff, dateShort, dateLong, todayET };
})();
