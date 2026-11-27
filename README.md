# VegVital 🌱

Personal health tracker for a **vegetarian, non-smoking, non-alcoholic** lifestyle: meals from pre-breakfast to post-dinner, water, steps, sleep, work breaks and workouts. It runs as an Android app (Capacitor + React + Framer Motion).

## What fills itself in

| Area | How it is tracked |
|---|---|
| Meals | Your nutritionist's 7-day plan (converted to 100% veg) is logged automatically 30 min after each meal window. If you ate something else, take a 📸 photo and the server's food AI counts kcal, protein, carbs, fat and fibre. |
| Steps, calories burned, weight | Health Connect (phone, Google Fit or smartwatch). If Health Connect isn't linked, the phone's sensor counts steps while the app is open. |
| Sleep | Health Connect sleep. If that isn't available, the app works it out from overnight phone inactivity, or falls back to your usual bed and wake times. |
| Work | Work hours come from your schedule. A stand-and-stretch reminder fires every 75 min, and each Desk Break you finish is counted. |
| Workouts | Animated guided programs: yoga, desk reset, strength, HIIT, walk and wind-down. Calories are logged when you finish. |
| Water | Reminder every 90 min. One tap adds a glass. |

Each person logs in with their own account. Their data is saved on the server, and nobody enters any API key in the app.

## Install on your phone
1. Open the repo's **Releases** page on your Android phone.
2. Download `VegVital.apk` and allow "Install unknown apps".
3. First launch: enter your name, age, height and weight, then allow Health Connect and notifications.
4. Log in or create an account. Your data is saved at https://healthtest.space.

## Server (healthtest.space)
`server/` is a small Node.js (Express) app that serves the website, the admin page (`/admin`) and the API the phone app uses. Data lives in Neon Postgres.

Settings (environment variables on the host):

| Name | What |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `JWT_SECRET` | long random text (keeps people logged in) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | admin login; also works in the app |
| `GEMINI_API_KEY`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY` | food-photo AI, tried in this order; set at least one |
| `ALLOW_SIGNUP` | `false` to stop new sign-ups |
| `SCANS_PER_DAY` | photo readings per user per day (default 80) |

Start: `npm run build && npm start`. Local test with a throwaway database: `npm run server:dev` (admin `admin@vegvital.test` / `admin-test-123`).

## Develop
```bash
npm install
npm run dev            # browser preview at http://localhost:5173
```
Every push to `main` builds a signed APK and a Play Store bundle (`VegVital-play.aab`) on GitHub Actions and publishes them as a release.

## Signing key
`keys/vegvital-release.p12` and its password are **not** in git. They're stored as the GitHub secrets `KEYSTORE_B64` and `KEYSTORE_PASSWORD`. Back up the `keys/` folder: you need the same key for every future update to install over the old app.

## Roadmap
- Non-veg mode (the data model already has `profile.diet`)
