# Philly Panic Index

The website for the Philly Panic Index (@phlpanicindex): a daily index of panic surrounding the Eagles, Phillies, Sixers and Flyers. The numbers are real. The analysis is unnecessary.

A static site with no build step.

- `index.html`: the index, team components, desk notes and the tape of official prints.
- `methodology.html`: how the index is calculated, plus a calculator.
- `assets/`: styles and scripts.
- `data/ppi.js`: the published readings. Generated; do not edit by hand.
- `tools/update-data.ps1`: rebuilds `data/ppi.js` from the Official Log.

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
   git add data/ppi.js
   git commit -m "Official print"
   git push
   ```

Rows marked VERIFYING or BLOCKED are skipped. If today's row is missing, the site says so and shows the last official reading with its date; it never presents an old reading as today's.

To preview locally, run `python -m http.server 8417` in this folder and open http://localhost:8417.
