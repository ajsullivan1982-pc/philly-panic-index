# Philly Panic Index

The website for the Philly Panic Index (@phlpanicindex): a daily index of panic surrounding the Eagles, Phillies, Sixers and Flyers. The numbers are real. The analysis is unnecessary.

A static site with no build step.

- `index.html`: the index, team components, desk notes and the tape of official prints.
- `methodology.html`: how the index is calculated, plus a calculator.
- `eagles.html`, `phillies.html`, `sixers.html`, `flyers.html`: one page per team. The four files differ only in the team named in the head and on `<body>`; `assets/team.js` draws them.
- `research.html` and `research/`: research notes. Copy `research/_template.html` for a new one; its preview image is made from `tools/article-card.html`.
- `weekly.html`: the Weekly Panic Report, one Monday-to-Sunday week summarized. Drawn by `assets/weekly.js`; it needs no upkeep. Adding `?email=1` to the address shows the copy-for-email panel used for the newsletter.
- `404.html`: shown for any address that does not exist.
- `prints/`: one page per official print (`prints/2026-11-24.html`) and `prints/index.html`, the full list. Generated; do not edit by hand.
- `sitemap.xml` and `llms.txt` (a plain-text summary for AI tools): generated; do not edit by hand. New research notes are picked up on the next data run.
- `feed.xml`: the RSS feed (latest prints and research notes). Generated; do not edit by hand.
- `assets/`: styles and scripts.
- `data/ppi.js`: the published readings. Generated; do not edit by hand.
- `tools/update-data.ps1`: rebuilds `data/ppi.js` and `feed.xml` from the Official Log, then runs `tools/site-pages.ps1`.
- `tools/site-pages.ps1`: writes the latest figures into `index.html` and the four team pages as plain HTML (the scripts in `assets/` redraw them in the browser), plus `prints/`, `sitemap.xml` and `llms.txt`. This is what search engines and AI tools that do not run JavaScript see.
- `tools/card.html`, `tools/article-card.html`, `tools/icon.html`: sources for the link-preview images and home-screen icons. Each file's first lines say how to rebuild its image.

## Daily update

Automatic. Nothing to run.

- The workbook's `Site Feed` tab mirrors the Official Log, minus research summaries and calculation notes, and is published to the web as CSV. It is the only public tab.
- `.github/workflows/update-data.yml` downloads that feed, rebuilds `data/ppi.js`, and commits only when the readings changed.
- What starts that job: an Apps Script in the workbook checks the `Site Feed` tab every 5 minutes and asks GitHub to run the job when anything changed. A new row reaches the site in roughly 5 to 10 minutes. `tools/sheet-trigger.gs` is a reference copy of that script; the live copy is in the workbook (Extensions > Apps Script), and its GitHub token is in the script's properties, never in this repository.
- Backups: the job also runs on GitHub's own 15-minute schedule, which in practice runs hours late, and on every push to `main`.
- If prints stop appearing, the token has probably expired: create a new fine-grained token (this repository only, Actions: Read and write) and replace `GITHUB_TOKEN` in the script's properties.
- To force a run: the repository's Actions tab > Update readings > Run workflow.
- The job refuses to publish fewer readings than are already live. After deleting a row on purpose, run the manual steps below with `-AllowShrink`.
- Do not edit the `Site Feed` tab; it is one formula in A1. To stop the feed: File > Share > Publish to web > Stop publishing.

### By hand

1. In the Official Calculation Log workbook, open the Official Log tab and choose File > Download > Comma-separated values (.csv).
2. Rebuild the data file:

   ```powershell
   powershell -ExecutionPolicy Bypass -File tools\update-data.ps1 -Source "C:\path\to\Official Log.csv"
   ```

3. Publish:

   ```powershell
   git add data/ppi.js index.html feed.xml eagles.html phillies.html sixers.html flyers.html prints sitemap.xml llms.txt
   git commit -m "Official print"
   git push
   ```

Rows marked VERIFYING or BLOCKED are skipped. If today's row is missing, the site says so and shows the last official reading with its date; it never presents an old reading as today's.

## Weekly newsletter

The Weekly Panic Report goes out by email once a week, on Monday morning, from Beehiiv (beehiiv.com, signed in as the site's contact address). About 10 minutes a week.

Automatic:

- `weekly.html` works out the finished week from `data/ppi.js`: the one-line summary, open/high/low/close, mover of the week, the board and each day's headline. The jokes are canned lines picked by the numbers.
- The signup panel on `index.html` and `weekly.html` shows the Beehiiv form "phillypanic.com signup" (Subscribers > Subscribe forms). New subscribers get the welcome email set under Beehiiv's Settings > Emails > Preset Emails. To hide the panel again, add the word `hidden` after `id="newsletter"` on both pages. The site itself stores no addresses.
- The look of the email (dark background, colours, the header and the footer) lives in the Beehiiv post template "Weekly Panic Report".
- Every Monday at about 6:30 AM a scheduled task in the Claude app, "Weekly Panic Report: Monday draft", builds the week's post as a Beehiiv **draft**. It fills in the report, a first draft of From the Research Desk and "Three things to say at the bar" (three real stories from the week's log, each ending on a line you can say out loud). It never sends or schedules anything. It runs while the Claude app is open; if the app is closed, it runs the next time the app starts. Find it under Scheduled in the app's sidebar.
- "Three things to say at the bar" is in the email only, not on the website. It is a reason to subscribe.

Each Monday, once the draft is in Beehiiv (Posts > Drafts), open it, write The week ahead, read the rest, fix anything you don't like, then send. If the task didn't run, do it by hand:

1. Open https://phillypanic.com/weekly.html?email=1. It shows the week that just ended (Monday to Sunday). Check the numbers look right.
2. In Beehiiv: Start writing > Use a template > Weekly Panic Report.
3. On the site, press Copy next to Subject and paste it into the post's title and subject line. Do the same with Preview text (subtitle and preview text).
4. Press "Copy report for email". In the Beehiiv post, select the line that starts PASTE THE REPORT HERE and paste over it.
5. Write the three sections that are yours: Three things to say at the bar (three real stories from the week, using only what's in the Official Log), The week ahead (games and dates that could move the number) and From the Research Desk (a short paragraph, or a link to the newest note in `research/`). Nothing should be invented: if there is nothing to say, say so or delete the section.
6. Preview, send yourself a test if anything looks off, then send or schedule.

Things to know:

- Every figure in the pasted report comes from `data/ppi.js`. To change the wording of the canned lines, edit `assets/weekly.js`; the page and the email share it.
- `weekly.html?email=1&w=YYYY-MM-DD` (the week's Monday) prepares an older week. A week still in progress shows a warning.
- If the copy button fails, select the text in the dashed box and copy it by hand.
- The signup form's colours and wording are edited in Beehiiv (Subscribers > Subscribe forms), then Publish. The embed code on the site does not need changing.
- Emails come from a Beehiiv address. Sending from a phillypanic.com address needs a paid Beehiiv plan and extra DNS records; the records that point phillypanic.com at GitHub Pages must stay as they are.

To preview locally, run `python -m http.server 8417` in this folder and open http://localhost:8417.
