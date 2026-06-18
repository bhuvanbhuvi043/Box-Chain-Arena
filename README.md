# Box Chain Arena

Box Chain Arena is a mobile-friendly dots-and-boxes strategy game with 100
shaped stages, AI opponents, offline two-player play, private online rooms,
registered player challenges, and virtual progression rewards.

## Quick Play Test

Open this link on phone, tablet, or desktop to test the latest GitHub build:

https://bhuvanbhuvi043.github.io/Box-Chain-Arena/

Latest gameplay update:

- Close a gate by tapping a more forgiving gate center or dragging dot-to-dot.
- Safer zoom controls, with no accidental double-tap zoom during play.
- Stronger single-door gate closing animation.
- More royal king/queen reactions during play.
- Stage 2-100 now uses much tougher AI chain-control strategy.
- Added private AI record and Shadow Treasury virtual gold grants.
- More compact gameplay HUD for extra board space.

## Live Builds

- Firebase Hosting: https://box-chain-arena.web.app
- GitHub Pages: https://bhuvanbhuvi043.github.io/Box-Chain-Arena/
- Privacy Policy: https://box-chain-arena.web.app/privacy_policy.html
- Account Deletion: https://box-chain-arena.web.app/account_deletion.html

Firebase Hosting is the production web location. The root HTML files mirror
`public/` so the existing GitHub Pages URL remains usable.

## Current Status

Working and deployed:

- Solo stages and AI gameplay
- Teaching Demo and strategy Guide
- Offline two-player mode
- Local Gold, Stars, Diamonds, daily rewards, inventory, and shop
- Profile, privacy, deletion, terms, rewards, about, support, and feedback pages
- Firebase Hosting
- Strict Realtime Database security rules

Backend source is implemented for:

- Email/password registration and verified profiles
- Transactional nickname reservation
- Server-created and joined rooms
- Server-validated moves and match settlement
- Challenge Points reservations and one-time rewards
- Player challenges, reports, blocks, and account deletion

Cloud Functions are not live yet because the Firebase project is still on the
Spark plan. Firebase requires the Blaze plan to deploy them. Until that upgrade
and a two-device QA pass are complete, online registration and multiplayer
must not be described as production-ready.

See [Deployment Status](docs/DEPLOYMENT_STATUS.md) and
[Production Release](docs/PRODUCTION_RELEASE.md).

## Project Structure

```text
.
|-- public/                       Firebase Hosting files
|-- functions/                    Trusted multiplayer/economy backend
|   |-- index.js
|   |-- stages.json
|   `-- test/
|-- docs/                         Release and QA documentation
|-- assets/                       Play Store and QA evidence locations
|-- scripts/                      Sync and project validation tools
|-- database.rules.json           Realtime Database security rules
|-- firebase.json                 Firebase deployment configuration
|-- index.html                    GitHub Pages mirror of public/index.html
`-- README.md
```

## Local Development

Requirements:

- Node.js 22
- Java 21 or newer for Firebase rules tests
- Firebase CLI for emulator and deployment commands

Install backend dependencies:

```powershell
npm ci --prefix functions
```

Serve the game:

```powershell
python -m http.server 4174 --directory public
```

Open `http://127.0.0.1:4174`.

## Checks

```powershell
npm run check
firebase emulators:exec --only database "npm --prefix functions run test:rules"
```

`npm run check` verifies frontend links, duplicate HTML IDs, the GitHub Pages
mirror, frontend module syntax, and Cloud Functions syntax.

## Editing and Deployment

Edit the live game in `public/index.html`. After changing any Firebase Hosting
file, update the GitHub Pages mirror:

```powershell
npm run sync:pages
```

Deploy Hosting and rules:

```powershell
firebase deploy --only hosting,database
```

After Blaze billing is approved:

```powershell
firebase deploy --only functions
```

App Check is currently in monitoring mode. Follow the release document before
enabling enforcement.

## Virtual Rewards Notice

Gold, Stars, Diamonds, Challenge Points, Victory Bonuses, boosts, and shop
items are virtual game rewards only. They have no cash, withdrawal,
cryptocurrency, gambling, betting, or real-world prize value.

## Ownership

Copyright 2026 Bhuvaneshwaran R. All rights reserved.

See [LICENSE.md](LICENSE.md).
