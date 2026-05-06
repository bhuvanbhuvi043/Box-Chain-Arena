# Box Chain Arena

**Box Chain Arena** is a childhood paper strategy game reborn as a modern web-based strategy duel game.

This project is inspired by the classic dots-and-boxes paper game, where players connect dots, complete boxes, and win by capturing more boxes than the opponent. Box Chain Arena upgrades that nostalgic idea with custom arenas, AI opponents, online multiplayer, virtual rewards, progression, and a mobile-friendly gameplay experience.

🌐 **Live Demo:**  
https://bhuvanbhuvi043.github.io/Box-Chain-Arena/

---

## Official Release

**Version:** Official Version 1  
**Build Title:** Box Chain Arena V4.6 - Online Flow Simplification  
**Status:** Public testing prototype  
**Created by:** Bhuvaneshwaran R

---

## Game Concept

Box Chain Arena is based on a simple childhood game:

1. Dots are placed on a board.
2. Players take turns drawing one line between two nearby dots.
3. When a player completes the fourth side of a box, that box becomes theirs.
4. Completing a box gives an extra turn.
5. The player with more captured boxes wins.

This version transforms that paper game into a digital strategy arena with:

- Touch-friendly line drawing
- AI opponents
- Box capture rewards
- Gold, stars, and diamonds
- Online duel modes
- Master AI challenge
- Custom stage layouts
- Player profile system
- Firebase-powered multiplayer

---

## Key Features

### Core Gameplay

- Dot-to-dot line drawing
- Box claiming system
- Extra turn after completing a box
- Strategic chain captures
- Majority-box win logic
- Stage-based progression
- Replayable levels

### Guided Learning

The game includes guidance systems to help new players understand:

- How to draw lines
- How to capture boxes
- How stars work
- How gold boxes work
- How online duels work
- How Entry Gold works

### Stage Progression

The game includes multiple custom duel arenas such as:

- Twin Gates
- Crown Trap
- Mirror Bridges
- Hourglass Duel
- Fortress Ring
- Lightning Lane
- Lotus Split
- Arrow Ambush
- Shield Wall
- Comet Path
- Stair Siege
- Butterfly Risk
- Arena Cross
- Jagged Island
- Vortex Box
- Final Gate
- Double Crown
- Side Chambers
- River Break
- Grand Labyrinth

Each arena has a different shape, layout, and strategy requirement.

### AI Opponents

The game includes different AI opponent styles:

- Friendly Rival
- Sharp Strategist
- Silent Master
- Final Boss
- Master AI

Master AI is available as a strong practice/challenge opponent when no real online players are available.

### Online Multiplayer

Box Chain Arena supports online play through Firebase Realtime Database.

Online modes include:

- Room-code multiplayer
- Create room
- Join room
- Copy/share room code
- Online player challenge
- Player invite system
- Ready/confirm flow
- Entry Gold confirmation
- Master AI challenge mode

### Player System

Players can register/login using Firebase Authentication.

The player system supports:

- Guest mode
- Registered player profile
- Email/password login
- Unique nickname
- Online status
- Wins
- Losses
- Match count
- Gold
- Diamonds
- Saved progress
- Cloud sync for player data

### Virtual Economy

Box Chain Arena includes a virtual reward system:

- Gold coins
- Stars
- Diamonds
- Daily rewards
- Hint bundles
- Retry shields
- Coin boosts
- Entry Gold duels

Important: **Gold, Entry Gold, diamonds, and all rewards are virtual in-game rewards only. They have no real money value.**

### Menu-Based UI

The main screen keeps only essential values visible:

- Gold
- Stars
- Diamonds
- Menu

Other options are moved into the menu to reduce clutter:

- Online
- Daily
- Next
- Shop
- Portal
- Guide
- Demo
- 2 Player
- Music

This makes the game cleaner and more mobile-friendly.

### Mobile-Friendly Design

The game is designed to work on:

- Desktop browser
- Mobile browser
- Tablet browser
- GitHub Pages hosting
- Firebase-connected web environment

The layout uses responsive CSS and touch-friendly controls.

---

## Tech Stack

This project is built using:

- HTML5
- CSS3
- JavaScript
- Canvas API
- Firebase Authentication
- Firebase Realtime Database
- LocalStorage
- GitHub Pages

No external frontend framework is required.

---

## Firebase Features Used

Firebase is used for:

- Anonymous guest authentication
- Email/password authentication
- Realtime room creation
- Room-code multiplayer
- Online player status
- Player profile storage
- Guest save storage
- Cloud save syncing
- Player challenge system
- Match/duel data handling

---

## How to Play

### Basic Gameplay

1. Open the game.
2. Select a stage.
3. Draw a line between two nearby dots.
4. Complete four sides of a box to claim it.
5. If you complete a box, you get another turn.
6. Capture more boxes than the opponent to win.
7. Earn stars, gold, and rewards.

### Online Room Code Mode

1. Open the menu.
2. Click **Online**.
3. Choose **Play with Room Code**.
4. Create a room.
5. Share the room code with your friend.
6. Friend joins using the same code.
7. Confirm Entry Gold if needed.
8. Start the duel.

### Online Player Challenge

1. Register/Login with email and nickname.
2. Open **Player Portal**.
3. Open **Online Players**.
4. Select an online player.
5. Choose arena and optional Entry Gold.
6. Send challenge.
7. Opponent accepts.
8. Duel begins.

### Master AI Challenge

If no real player is online, players can challenge **Master AI**.

Master AI:

- Is always available
- Chooses random arenas
- Plays with stronger strategy
- Helps players practice online duel flow

---

## Game Rewards

### Gold

Gold is earned through:

- Capturing gold boxes
- Winning stages
- Daily rewards
- Master AI challenges
- Online duels
- Diamond conversion inside shop

### Stars

Stars are earned based on stage performance:

- 1 star for winning majority boxes
- More stars for stronger play
- Perfect stage performance can unlock better rewards

### Diamonds

Diamonds are rare rewards, mainly earned through strong stage performance.

Diamonds can be used in the marketplace for virtual upgrades.

---

## Important Notice

**Entry Gold is only a virtual in-game reward.**

This game does not include:

- Real money betting
- Real cash withdrawal
- Gambling
- UPI payment
- Real money reward system

All coins, gold, diamonds, Entry Gold, and rewards are only part of the game experience.

---

## Project Purpose

This project was created as a product prototype to explore:

- Childhood game nostalgia
- Strategy-based casual gaming
- Online duel mechanics
- Firebase multiplayer
- Mobile-first web game design
- Player reward psychology
- Indie game product development

This is currently a public testing prototype and not a final commercial release.

---

## Current Limitations

This version is suitable for testing and feedback, but before a full public/commercial release, the following improvements are planned:

- Stronger Firebase security rules
- Firebase Cloud Functions for verified match results
- Server-side Entry Gold validation
- Anti-cheat protection
- Better matchmaking
- Improved leaderboard
- Android app version
- Play Store release
- Privacy policy page
- Terms and conditions page

---

## Future Roadmap

Planned improvements:

- Android app version
- Play Store testing release
- Better onboarding animation
- More duel arenas
- More AI difficulty levels
- Leaderboard
- Match history
- Friend system
- Rematch system
- Improved sound effects
- Better mobile UI polish
- Cloud Functions-based secure match validation

---

## Installation / Local Setup

To run the game locally:

1. Download or clone this repository.
2. Open the project folder.
3. Open `index.html` in a browser.

For best testing, use a local server such as VS Code Live Server:

```bash
# Example using VS Code Live Server
Open index.html with Live Server
