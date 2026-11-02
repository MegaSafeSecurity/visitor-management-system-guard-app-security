# Visitor Management System and Guard App

This package replaces the attached attendance-only design with a Google Sheets-bound VMS and guard app. It is designed for a single source of truth: `Employee ID`, `Site ID`, `Checkpoint ID`, and `Visitor ID` are stable keys. HR may update a guard's name, phone, position, default site, or status without breaking the roster, next QR card, attendance, visitor record, log book, checkpoint history, or report.

## Included

- `VMS_Guard_App_Template.xlsx`: the Google Sheets import template with all operational tabs.
- `Code.gs`: Apps Script server logic.
- `index.html`: mobile-friendly Guard App and HR/Admin web UI.
- `appsscript.json`: Apps Script project settings and scopes.

## One-time installation

1. Upload the template `.xlsx` to Google Drive and open it with Google Sheets. Rename it if required.
2. In that spreadsheet choose **Extensions → Apps Script**. Replace the default project files with `Code.gs`, `index.html`, and `appsscript.json` from this package.
3. Save. From the Apps Script editor, run `setupVms` once and approve Google permissions. This creates or verifies every tab without deleting operational body rows, and stores the bound spreadsheet ID for web-app requests. If a tab name exists with incompatible headers, the function stops instead of overwriting it.
4. Return to the sheet. Choose **VMS Guard App → Set or change admin password**. Use a unique password of at least 12 characters. The system stores only a salted hash in Script Properties, never in the sheet.
5. In Apps Script choose **Deploy → New deployment → Web app**. Use the account that owns the spreadsheet and select access appropriate to your organisation. Copy the deployed `/exec` URL.
6. Add active sites with true latitude, longitude and a realistic radius. Add checkpoints. Add employees. Create a duty roster. Then print employee and checkpoint QR labels from the HR/Admin tab of the web app.

## Operating flow

1. Guard scans their employee QR. The signed guard context is shared across tabs on that device and expires from browser storage after 12 hours. End the guard session on shared devices.
2. The guard selects their site and records Clock In or Clock Out. GPS accuracy and the site radius are validated by Apps Script.
3. The guard scans a checkpoint QR and records a checkpoint check. An optional compressed photo is stored in the VMS owner Drive folder, and the private file link is written to `CHECKPOINT LOG`.
4. The guard registers a visitor at the gate, with host, purpose, pass number, optional photo and GPS. The `VISITOR LOG` retains the same record at check-out. ID/passport input is masked before it is stored.
5. The guard records any handover, incident, safety, maintenance or general observation in `SECURITY LOG BOOK`, again with optional image evidence.
6. HR generates a daily report in `DAILY SITE REPORT`. It contains visitor check-ins and visitors still on site, while the Admin report view lists recent visitor movements and checkpoint photo links.

## HR source and deployment

- The app reads the `EMPLOYEES` tab in the spreadsheet to which Apps Script is bound. HR can edit a guard's name and profile in that tab or in the HR/Admin screen; keep `Employee ID` unchanged. The next QR lookup and new records use the latest name, while historical logs retain the name recorded at the time.
- It does not automatically synchronize a separate HR spreadsheet. That requires the HR workbook's sharing permission and a confirmed mapping for employee ID, name, status and other fields.
- Updating these project files does not update an already deployed web app by itself. Create a new deployment version after saving. The `/exec` URL supplied with this project redirects unauthenticated visitors to Google sign-in; configure web-app access for the intended guard accounts and verify the deployed URL while signed in as a guard.

## Important design choices

- **Name change is safe.** HR edits the employee row using the existing Employee ID. The QR revision is preserved. New displays use the current name; historic audit rows keep their original name snapshot.
- **Lost cards are safe to revoke.** HR selects **Rotate lost QR**. Only that employee's QR revision changes; the old physical card becomes invalid. Do not edit the QR revision directly in the spreadsheet.
- **No plain supervisor PIN in Sheets.** Admin web sessions expire after 30 minutes. The password hash and signing secret remain in Apps Script Script Properties.
- **Every mobile write is idempotent.** Each attendance, checkpoint and log-book submission uses a request ID plus a document lock. Retrying after weak mobile connectivity cannot create a duplicate record.
- **Photo evidence stays private by default.** Images are placed in a Drive folder owned by the deploying account. Do not make that folder public. Grant the relevant HR accounts access to the private evidence folder so they can open checkpoint/log-book links.
- **Roster stores IDs, not names.** A rename therefore cannot detach a shift from the guard.
- **Visitor privacy is deliberate.** The operational screen never returns full ID/passport numbers. If entered, only a masked suffix is written to `VISITOR LOG`; photographs stay in the owner-controlled evidence folder.

## QR security boundary

The printed QR is a signed bearer credential: it is protected from editing or guessing, and it is invalid after a rotation. A photographed or copied physical QR can still be presented by someone at the same location. For stronger identity assurance, require a company MDM device, an authenticated Google account deployment, a guard PIN, or biometric/device controls in addition to the QR and GPS check. GPS also indicates device location, not human identity. No system can honestly guarantee “100% no problem” without those operational controls and a field pilot.

## Pre-live checks

1. Confirm the spreadsheet and Apps Script timezone is `Asia/Kuala_Lumpur`.
2. Test an Employee ID rename. Re-open the existing QR and verify it shows the new name while its revision remains unchanged.
3. Test a lost-card rotation. Verify the old QR gives “invalid or replaced” and the reprinted QR works.
4. Test Clock In, duplicated form retry, Clock Out, a night shift, and an off-roster attempt.
5. At every site, test GPS inside and outside the selected radius, and test a checkpoint photo upload on the intended guard device.
6. Check in and check out a test visitor. Confirm the full ID/passport number is not written to the sheet and that the same `Visitor ID` is updated at checkout.
7. Generate the daily report and open one checkpoint image link using the HR account.

## Notes

- The QR image is rendered from a Google-hosted QR image URL for printing. Server-side validation uses the local Apps Script HMAC signing secret, not that renderer.
- The template contains no real employee, visitor, credential, GPS or photo data.
- Do not change tab headers or reuse IDs after the system is live. Use the app's status fields instead of deleting audit rows.
