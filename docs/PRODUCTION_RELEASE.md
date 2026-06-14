# Box Chain Arena Production Release

## Release Gate

Do not upload the production build until every item below is complete.

1. Reauthenticate the Firebase CLI if required:

   ```powershell
   firebase login --reauth
   ```

2. Confirm the project is on the Blaze plan, Email/Password Authentication is enabled, and Anonymous Authentication is disabled.
3. In Google Cloud, create a reCAPTCHA Enterprise score-based website key for:
   - `box-chain-arena.web.app`
   - `box-chain-arena.firebaseapp.com`
   - Any custom production domain
4. Register the web app in Firebase App Check and replace `REPLACE_WITH_RECAPTCHA_ENTERPRISE_SITE_KEY` in `public/index.html`.
5. Keep `ENFORCE_APP_CHECK=false` in `functions/.env.box-chain-arena` for the first monitored deployment.
6. Treat `public/index.html` as the only active production game file. Do not edit archived copies.
7. Deploy Functions, Realtime Database Rules, and Hosting:

   ```powershell
   firebase deploy --only functions,database
   firebase deploy --only hosting
   ```

8. In Firebase App Check metrics, confirm valid production requests are arriving without disrupting legitimate players.
9. Change `ENFORCE_APP_CHECK=true` in `functions/.env.box-chain-arena`, redeploy Functions, and then enable App Check enforcement for Realtime Database and Authentication in Firebase Console.

Cloud Functions require the Firebase project to use the Blaze plan.

If the Android app loads `index.html` from `file://` inside a WebView, do not ship the web reCAPTCHA provider as-is. Either load the game from the approved HTTPS Hosting domain or integrate the native Firebase Android SDK with Play Integrity and bridge the verified backend calls into the WebView.

## Production Data Model

- `privateProfiles/{uid}`: email, Challenge Points, reservations, settlement ledger, private progress totals.
- `publicProfiles/{uid}`: nickname, presence, wins, losses, match count.
- `rooms/{code}`: participants, legal moves, scores, point commitments, settlement status.
- `matches/{code}`: immutable verified result.
- `blocks`, `reports`, `invites`: server-created safety and challenge data.
- Solo Gold, Diamonds, inventory, and detailed stage progress remain device-local.

Clients cannot directly write Challenge Points, wins, losses, match results, room moves, room status, nicknames, reports, or blocks.

## Play Console URLs

After Hosting deployment, verify these exact URLs in an incognito window:

- Privacy Policy: `https://box-chain-arena.web.app/privacy_policy.html`
- Account Deletion: `https://box-chain-arena.web.app/account_deletion.html`

Use the account-deletion URL in Play Console's Data safety form.

## Required Console Checks

- Data safety answers must disclose email, user IDs, nickname, presence, gameplay activity, reports, and diagnostics actually collected by the Android wrapper and Firebase services.
- Confirm the Android wrapper itself does not add undeclared analytics, advertising IDs, location, contacts, files, or device identifiers.
- Ensure the Play Store privacy-policy field and in-app policy resolve to the same current policy.
- Keep the account-deletion page public without requiring login.

## Verification

Static checks:

```powershell
node --check functions/index.js
firebase emulators:exec --only database "npm --prefix functions run test:rules"
```

The rules test requires Java because the Firebase Realtime Database Emulator runs on Java.

Complete `docs/QA_PRODUCTION_MATRIX.md` with named testers and evidence before release.
Store screenshots and videos in `assets/qa-evidence`.
