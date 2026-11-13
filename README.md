# Philly Panic Index

The website for the Philly Panic Index (@phlpanicindex): a daily index of panic surrounding the Eagles, Phillies, Sixers and Flyers. The numbers are real. The analysis is unnecessary.

A static site with no build step.

- `index.html`: the index, team components, desk notes and the tape of official prints.
- `methodology.html`: how the index is calculated, plus a calculator.
- `assets/`: styles and scripts.
- `data/ppi.js`: the published readings. Generated; do not edit by hand.
- `tools/update-data.ps1`: rebuilds `data/ppi.js` from the Official Log.

## Daily update

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
