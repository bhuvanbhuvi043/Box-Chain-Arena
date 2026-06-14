# Box Chain Arena Deployment Status

Checked: June 14, 2026

## Live

- Firebase Hosting: deployed
- Realtime Database rules: deployed
- Main game: `https://box-chain-arena.web.app`
- Privacy Policy: `https://box-chain-arena.web.app/privacy_policy.html`
- Account Deletion: `https://box-chain-arena.web.app/account_deletion.html`
- Terms, rewards, about, developer, support, and feedback pages: deployed

## Waiting for Project Owner

Cloud Functions could not be deployed because the Firebase project is on the
Spark plan. Firebase requires the Blaze plan before it can enable Cloud
Functions, Cloud Build, and Artifact Registry.

Upgrade page:

`https://console.firebase.google.com/project/box-chain-arena/usage/details`

After the owner approves the Blaze upgrade, run from the production folder:

```powershell
firebase deploy --only functions
firebase functions:list
```

Online registration, rooms, challenges, verified moves, reports, blocks, and
account deletion depend on these functions. Do not call online multiplayer
production-ready until the functions are deployed and a two-device test passes.

## App Check

The code is intentionally in Firebase's monitoring phase:

`functions/.env.box-chain-arena` contains `ENFORCE_APP_CHECK=false`.

After the web App Check provider and site key are configured, monitor valid
requests, change the value to `true`, redeploy Functions, and enable product
enforcement in Firebase Console.
