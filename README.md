# CageOps

Live, shared scanner register for cage → JNX handover and bagging → dispatch, Skynet Elandsfontein. Every checkout links a **registered physical scanner** to a **registered person** — both verified, not typed free text — and shift roll calls replace writing IMEIs down by hand.

## Two ways to run it
- **`index.html`** — a control-room view for a phone/tablet/PC: scan any unit's barcode to check it in/out, run shift roll calls, see the live log, export CSV.
- **`device.html`** — installed directly on each hand scanner: the device already knows which unit it is, so operators just log in/out with their TT#. No barcode scanning needed on the device itself for register purposes.

Both talk to the same backend, so a unit checked out from `device.html` shows up live in `index.html` and vice versa.

## What it does
- **Scan to identify a scanner** (`index.html`). A dedicated scan field takes input from a barcode-scanner "keyboard wedge" (scan → Enter, same as typing) or your device camera (📷 Camera scan, works on phone/tablet). Works with the existing IMEI barcode on the back of each unit, or a printed QR label from `labels.html`.
- **Log in / log out on the device itself** (`device.html`). Pair a hand scanner to its identity once (pick it from the registry, or register it fresh); after that the screen just asks "Your TT#/ID" to log in, and shows a big Log Out button while someone's using it. No barcode scanning on the device — it always knows what it is.
- **Scan to toggle** (`index.html`). Scan a checked-in unit → opens the checkout form. Scan a checked-out unit → offers to check it straight in.
- **Usage is chosen at checkout/login, not fixed to a unit.** These 6 scanners are used interchangeably for either stage, so every checkout — from `index.html` or `device.html` — asks which one you're doing: **Scan to JNX** or **Bagging to Dispatch**. It's logged per entry, not locked to the physical scanner.
- **Every operator is a registered user, not a typed name.** Enter a TT#/ID; if it's known, their name resolves automatically. If it's new, you register it once (TT# + full name) and it's recognised everywhere after that — on any device. Login/checkout requires both a verified scanner **and** a verified user — the server checks both independently before logging anything.
- **Shift roll call** (`index.html`) replaces writing down IMEIs at the start/end of shift: pick Start of Shift or End of Shift, scan every unit, confirm your own TT#, Finish. It logs who did the roll call, what was scanned, and flags anything missing.
- **Currently in use / today's log** — live shared view across all devices, with operator name + ID shown against every entry, plus CSV export for the daily POW report.

## Why a backend
GitHub Pages only serves static files. Since several scanners can be checked in/out at once and everyone needs the same live state — the same scanner registry and the same user registry — this uses a free Google Sheet + Apps Script as shared storage. No server to run or pay for.

## Setup (one-time, ~10 min)
1. Create a new Google Sheet.
2. Create **four** tabs, named exactly:
   - `Entries` — headers: `id | scannerId | operatorId | operatorName | timeIn | timeOut | usage`
   - `Scanners` — headers: `code | label | registeredAt`
   - `Users` — headers: `ttNumber | name | registeredAt`
   - `RollCalls` — headers: `id | shiftType | timestamp | operatorId | operatorName | scannedLabels | missingLabels`
3. Extensions → Apps Script → delete the starter code → paste in `Code.gs` from this repo.
4. Deploy → New deployment → **Web app** → Execute as **Me**, access **Anyone**.
5. Copy the deployed Web App URL.
6. Open `index.html` **and** `device.html`, find `WEBAPP_URL = 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE'` near the top of each, and paste your URL into both. (`labels.html` doesn't need it — it only generates printable QR codes.)
7. Commit and push. Enable GitHub Pages.

Re-deploy (**new version**, not just save) any time you edit `Code.gs`, or your changes won't go live.

## Installing on the hand scanners
1. On each hand scanner's browser, open `device.html` from your GitHub Pages URL.
2. Use the browser menu → **Add to Home Screen**. It'll appear as its own icon (`manifest.json` sets the name and a dark full-screen look).
3. Open it once, pair it to a scanner — either pick an already-registered unit from the list, or register it fresh (just a label) right there. This is stored **on that device only** (browser local storage), so you only do it once per physical unit.
4. From then on, the app opens straight to a login screen: type TT#, pick **Scan to JNX** or **Bagging to Dispatch** for this stint, tap Log in. A big Log Out button shows for as long as they're using it.

If a hand scanner is ever wiped, reset, or handed to IT, tap **Re-pair** at the top of the screen to unbind it (or it'll just ask to pair again on next open).

## Day-to-day use
- **New scanner, first time:** either scan its back barcode in `index.html` (or a printed label from `labels.html`), or pair it directly in `device.html` — just needs a label.
- **New person, first time:** type their TT#/ID at login/checkout on either app — if unknown, you'll be asked for their name once, and it's remembered everywhere after.
- **On the hand scanner (`device.html`):** type your TT#, pick JNX or bagging for this stint, tap Log in. Tap Log out when you're done.
- **From a phone/tablet (`index.html`):** scan the unit, enter/confirm your TT#, pick usage, tap Check out. Scan it again to check back in.
- **Start/end of shift:** on `index.html`, tap the roll-call button, scan every unit, enter your TT#, Finish. Missing units are flagged before you submit.

## Pre-loading known IMEIs
If you already have the IMEIs for your scanners, skip the in-app registration step entirely — add rows straight into the **Scanners** sheet:

| code | label | registeredAt |
|---|---|---|
| 359832290089336 | Scanner 1 | (today's date) |
| 359832290199580 | Scanner 2 | (today's date) |
| 359832290213662 | Scanner 3 | (today's date) |
| 359832290199655 | Scanner 4 | (today's date) |
| 359832290199309 | Scanner 5 | (today's date) |
| 359832290197386 | Scanner 6 | (today's date) |

After that, scanning any unit's real IMEI barcode in `index.html` matches instantly — no printed QR labels needed unless a barcode is too worn to scan reliably.

## Files
- `index.html` — control-room register (scan-based, roll call, log, CSV export)
- `device.html` — kiosk login/logout screen meant to live on each hand scanner
- `manifest.json` — lets `device.html` be installed as a home-screen app
- `labels.html` — optional printable QR label sheet for units whose IMEI barcode is worn or fiddly to scan
- `Code.gs` — Apps Script backend (paste into the Sheet's script editor)

## Notes
- Camera scanning in `index.html` needs HTTPS (GitHub Pages is fine) and camera permission in the browser.
- `device.html`'s device-pairing is stored per-browser (localStorage) — if a hand scanner's browser data gets cleared, it'll just ask to pair again; no data is lost server-side.
- Anyone with the Web App URL can read/write — fine for internal floor use, don't publish it outside the team.
- The Sheet is your audit trail for every check-out, check-in, registration, and roll call.
