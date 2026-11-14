/**
 * Philly Panic Index: publish trigger.
 *
 * Lives in the Official Calculation Log workbook (Extensions > Apps Script).
 * Every 5 minutes it looks at the "Site Feed" tab. When anything there has
 * changed since the last look, it tells GitHub to run the "Update readings"
 * job, which rebuilds the site's data. GitHub's own schedule stays on as a
 * backup, but it runs hours late; this does not.
 *
 * Setup, once:
 *   1. Project Settings > Script Properties > add GITHUB_TOKEN with a GitHub
 *      fine-grained token (this repository only, Actions: Read and write).
 *   2. Run the install function once and approve the permission prompt.
 *
 * This file in the website repository is a reference copy. The live copy is
 * the one inside the workbook. The token is never stored in this file.
 */

const REPO = 'ajsullivan1982-pc/philly-panic-index';
const WORKFLOW = 'update-data.yml';
const FEED_TAB = 'Site Feed';

/** Runs on the timer. Asks GitHub to publish only when the feed has changed. */
function checkAndPublish() {
  const props = PropertiesService.getScriptProperties();
  const sheet = SpreadsheetApp.getActive().getSheetByName(FEED_TAB);
  if (!sheet) throw new Error('Tab "' + FEED_TAB + '" was not found.');

  const values = sheet.getDataRange().getDisplayValues();
  const digest = Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(values), Utilities.Charset.UTF_8));
  if (digest === props.getProperty('LAST_DIGEST')) return;

  publishNow();
  // Remembered only after GitHub accepted the request, so a failure is retried next time.
  props.setProperty('LAST_DIGEST', digest);
}

/** Asks GitHub to run the update job right now. Safe to run by hand at any time. */
function publishNow() {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('GITHUB_TOKEN is not set in Script Properties.');

  const res = UrlFetchApp.fetch(
    'https://api.github.com/repos/' + REPO + '/actions/workflows/' + WORKFLOW + '/dispatches', {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      payload: JSON.stringify({ ref: 'main' }),
      muteHttpExceptions: true
    });

  if (res.getResponseCode() !== 204) {
    throw new Error('GitHub refused the request (' + res.getResponseCode() + '): ' + res.getContentText().slice(0, 300));
  }
}

/** Run once. Turns on the 5-minute timer (and replaces any earlier one). */
function install() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'checkAndPublish'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('checkAndPublish').timeBased().everyMinutes(5).create();
  checkAndPublish();
}

/** Turns the timer off. */
function uninstall() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'checkAndPublish'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
}
