# Box Chain Arena Play Store Release Checklist

Generated: May 17, 2026

## HTML/App Changes Completed

- Public title changed to `Box Chain Arena - Kingdom Strategy Game`.
- In-app Privacy & Data modal added.
- Privacy policy page added at `privacy_policy.html`.
- Player Profile now includes `Delete Account`.
- Account deletion removes player profile, nickname reservation, online status, incoming invites, guest save path, local save, and Firebase Auth login when the current login is recent enough.
- Virtual gold/Entry Gold wording remains clear: no real money value.
- Royal emotion animations upgraded for move, capture, gold, chain, alert, win, and loss.
- Play Store draft assets generated:
  - `playstore_assets/icon_512.png`
  - `playstore_assets/feature_graphic_1024x500.png`
  - `playstore_assets/screenshots/playstore_04_stage_start_1080x1920.png`
  - `playstore_assets/screenshots/playstore_05_gate_reaction_1080x1920.png`
  - `playstore_assets/screenshots/playstore_06_ai_reaction_1080x1920.png`

## Play Console Items You Still Need Outside This HTML

- Build an Android App Bundle (`.aab`) with your conversion tool.
- Target Android 15 / API level 35 or higher for new apps and updates.
- Enroll in Play App Signing and sign the app bundle.
- Add a real developer contact email in Play Console.
- Host `privacy_policy.html` at a public HTTPS URL, for example Firebase Hosting.
- Use that public HTTPS privacy policy URL in Play Console and inside your app wrapper if your tool supports it.
- Complete App Content declarations: Data safety, Privacy policy, Account deletion, Content rating, Target audience, Ads status, and App access.
- Review and upload store assets: icon, feature graphic, at least two phone screenshots, short description, full description, and category.

## Data Safety Draft

Declare that the app collects:

- Email address: account management / authentication.
- User IDs: Firebase Auth uid and nickname for account management and multiplayer.
- App activity/gameplay: stage progress, moves, scores, match results, virtual rewards.
- App interactions/presence: online status, last seen, invites, room status.

Declare that data is transmitted to Firebase for app functionality, online multiplayer, account management, and progress saving. If your Android wrapper adds analytics, ads, crash reporting, device identifiers, or location, update Data safety and the privacy policy before release.

## QA Screenshot Folder

Store new test evidence under:

`C:\Box Chain Arena\box-chain-arena-production\assets\qa-evidence`

Store final Google Play listing images under:

`C:\Box Chain Arena\box-chain-arena-production\assets\playstore`
