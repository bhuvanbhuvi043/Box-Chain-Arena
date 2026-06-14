# Box Chain Arena QA Test Report

Date: May 17, 2026

## Local Build

- URL tested: `http://127.0.0.1:4174/index.html`
- Current production file: `C:\Box Chain Arena\box-chain-arena-production\public\index.html`
- Older copies are retained under `C:\Box Chain Arena\archive`.
- Browser console errors/warnings during smoke tests: none observed.
- Classic script parse check: passed.

## Tested Screens

Historical screenshot names from this test:

- `qa_screenshots\01_initial_map_or_demo.png`
- `qa_screenshots\02_mobile_current_state.png`
- `qa_screenshots\03_mobile_level_map.png`
- `qa_screenshots\04_mobile_menu.png`
- `qa_screenshots\05_mobile_privacy_modal.png`
- `qa_screenshots\06_mobile_profile_modal.png`
- `qa_screenshots\07_mobile_shop_modal.png`
- `qa_screenshots\08a_mobile_stage1_start.png`
- `qa_screenshots\09_mobile_gate_emotion_reaction.png`
- `qa_screenshots\10_mobile_ai_reaction.png`
- `qa_screenshots\11_privacy_policy_page.png`
- `qa_screenshots\12_desktop_current_state.png`

Play Store draft screenshots:

- `playstore_assets\screenshots\playstore_04_stage_start_1080x1920.png`
- `playstore_assets\screenshots\playstore_05_gate_reaction_1080x1920.png`
- `playstore_assets\screenshots\playstore_06_ai_reaction_1080x1920.png`

For new release evidence, use `assets\qa-evidence`. Store listing images belong in
`assets\playstore`.

## Result

- Mobile gameplay layout: passed smoke test.
- Kingdom reaction row: visible and no longer covering board.
- Royal emotion bubbles: visible during turn/reaction states.
- Privacy modal: opens from Menu.
- Profile modal: opens and includes Delete Account.
- Shop modal: opens.
- Privacy policy page: loads locally.

## Not Fully Covered Locally

- Real two-device Firebase multiplayer should be tested after Firebase Hosting deployment.
- Android wrapper build, target SDK, app permissions, package name, signing, and AAB upload must be verified in the Android tool and Play Console.
