/**
 * CageOps — backend (v4: usage chosen at checkout, not fixed per scanner)
 *
 * SETUP:
 * 1. Create a new Google Sheet (sheet.new).
 * 2. Create FOUR tabs, named exactly:
 *      Entries   — headers: id | scannerId | operatorId | operatorName | timeIn | timeOut | usage
 *      Scanners  — headers: code | label | registeredAt
 *      Users     — headers: ttNumber | name | registeredAt
 *      RollCalls — headers: id | shiftType | timestamp | operatorId | operatorName | scannedLabels | missingLabels
 *
 *    These 6 units are used interchangeably for either stage, so usage is
 *    NOT fixed per scanner — it's chosen at checkout/login time and logged
 *    per entry. Only the scanner code and the operator ID are verified
 *    against registries server-side.
 * 3. Extensions → Apps Script. Delete starter code, paste this whole file in.
 * 4. Deploy → New deployment → Web app.
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the Web App URL into WEBAPP_URL at the top of index.html and device.html.
 * 6. Re-deploy (new version) any time you edit this script.
 */

function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function readAll(sheetName) {
  const sheet = getSheet(sheetName);
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift();
  return rows
    .filter(r => r[0])
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = r[i]);
      return obj;
    });
}

function doGet(e) {
  const action = e.parameter.action || 'list';

  if (action === 'list') {
    return jsonOut({ entries: readAll('Entries') });
  }
  if (action === 'scanners') {
    return jsonOut({ scanners: readAll('Scanners') });
  }
  if (action === 'users') {
    return jsonOut({ users: readAll('Users') });
  }
  if (action === 'rollcalls') {
    const all = readAll('RollCalls');
    return jsonOut({ rollcalls: all.slice(-10).reverse() });
  }
  return jsonOut({ error: 'Unknown action' });
}

function findScanner(code) {
  const rows = getSheet('Scanners').getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(code)) return { code: rows[i][0], label: rows[i][1] };
  }
  return null;
}

function findUser(ttNumber) {
  const rows = getSheet('Users').getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === String(ttNumber).toLowerCase()) {
      return { ttNumber: rows[i][0], name: rows[i][1] };
    }
  }
  return null;
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const action = payload.action;

  if (action === 'checkout') {
    // Scanner and operator are verified against their registries server-side.
    // Usage is legitimately chosen by the operator each time (these units
    // aren't dedicated to one stage) but is still validated to one of the
    // two allowed values so nothing garbage gets logged.
    if (payload.usage !== 'jnx' && payload.usage !== 'bagging') {
      return jsonOut({ ok: false, error: 'usage must be "jnx" or "bagging"' });
    }
    const scanner = findScanner(payload.code);
    if (!scanner) {
      return jsonOut({ ok: false, error: 'Unknown scanner — register it first' });
    }
    const user = findUser(payload.operatorId);
    if (!user) {
      return jsonOut({ ok: false, error: 'Unknown user — register them first' });
    }
    const sheet = getSheet('Entries');
    const id = Utilities.getUuid();
    sheet.appendRow([id, scanner.label, user.ttNumber, user.name, new Date().toISOString(), '', payload.usage]);
    return jsonOut({ ok: true, id, operatorName: user.name });
  }

  if (action === 'checkin') {
    const sheet = getSheet('Entries');
    const row = findRowById(sheet, payload.id);
    if (row) sheet.getRange(row, 6).setValue(new Date().toISOString()); // timeOut is column 6
    return jsonOut({ ok: true });
  }

  if (action === 'delete') {
    const sheet = getSheet('Entries');
    const row = findRowById(sheet, payload.id);
    if (row) sheet.deleteRow(row);
    return jsonOut({ ok: true });
  }

  if (action === 'registerScanner') {
    const sheet = getSheet('Scanners');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(payload.code)) {
        sheet.getRange(i + 1, 2).setValue(payload.label);
        return jsonOut({ ok: true, updated: true });
      }
    }
    sheet.appendRow([payload.code, payload.label, new Date().toISOString()]);
    return jsonOut({ ok: true, created: true });
  }

  if (action === 'registerUser') {
    const ttNumber = (payload.ttNumber || '').trim();
    const name = (payload.name || '').trim();
    if (!ttNumber || !name) {
      return jsonOut({ ok: false, error: 'ttNumber and name are required' });
    }
    const sheet = getSheet('Users');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === ttNumber.toLowerCase()) {
        sheet.getRange(i + 1, 2).setValue(name);
        return jsonOut({ ok: true, updated: true });
      }
    }
    sheet.appendRow([ttNumber, name, new Date().toISOString()]);
    return jsonOut({ ok: true, created: true });
  }

  if (action === 'rollcall') {
    const user = findUser(payload.operatorId);
    if (!user) {
      return jsonOut({ ok: false, error: 'Unknown user — register them first' });
    }
    const sheet = getSheet('RollCalls');
    const id = Utilities.getUuid();
    sheet.appendRow([
      id,
      payload.shiftType,          // "start" or "end"
      new Date().toISOString(),
      user.ttNumber,
      user.name,
      (payload.scannedLabels || []).join(', '),
      (payload.missingLabels || []).join(', ')
    ]);
    return jsonOut({ ok: true, id });
  }

  return jsonOut({ ok: false, error: 'Unknown action' });
}

function findRowById(sheet, id) {
  const ids = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) return i + 2;
  }
  return null;
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
