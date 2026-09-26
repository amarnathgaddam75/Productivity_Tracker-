# LifeTracker — Setup, build & deploy guide

## 0. Prerequisites
- **Node.js 20.19+** (22 LTS recommended) and npm 10+
- **Java 11+**, only if you want to run the local Firebase emulators
- A Google account for Firebase (the free Spark plan is enough)

```bash
git clone https://github.com/amarnathgaddam75/Productivity_Tracker-.git
cd Productivity_Tracker-
npm install          # installs all workspaces (shared, desktop, mobile) + Electron + firebase-tools
npm test             # runs the shared core unit tests
```

## 1. Try it locally with no Firebase project (emulators)

```bash
npm run emulators                     # Auth :9099, Firestore :8080, UI http://localhost:4000
```
In a second terminal:
```bash
echo "VITE_FIREBASE_EMULATOR_HOST=127.0.0.1"      > packages/desktop/.env.local
echo "REACT_APP_FIREBASE_EMULATOR_HOST=127.0.0.1" > packages/mobile/.env.local
npm run dev:desktop        # Electron window with hot reload (DevTools open)
npm run dev:mobile         # PWA on http://localhost:3000
```
The emulators use the real security rules in `firebase/firestore.rules`. Remove the `*_EMULATOR_HOST` lines when you switch to a real project.

## 2. Create the Firebase project
1. Go to <https://console.firebase.google.com>, click **Add project**, and give it a name (Google Analytics is optional).
2. **Authentication → Get started → Sign-in method → Email/Password → Enable.**
3. **Firestore Database → Create database** → *production mode* → pick a region.
4. **Project settings → General → Your apps → Web (`</>`)**, register an app (e.g. "LifeTracker"), and tick *Also set up Firebase Hosting*. Copy the `firebaseConfig` values.
5. Put the config in both apps. This repo already ships the config for the `lifetracker-90c0b` project in `packages/desktop/.env` and `packages/mobile/.env`. To use your own project, replace the values there, or override them in a git-ignored `.env.local`:

   `packages/desktop/.env`
   ```ini
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
   VITE_FIREBASE_APP_ID=1:1234567890:web:abc123
   VITE_MOBILE_URL=https://your-project.web.app
   ```
   `packages/mobile/.env`: the same values, but with the `REACT_APP_` prefix, plus `REACT_APP_DESKTOP_DOWNLOAD_URL`.

   > The Firebase web config is not a secret: it only identifies your project, and it ships inside every web app that uses Firebase. Access is protected by Auth and the Firestore rules.

6. Set your project id in `.firebaserc` (replace `your-firebase-project-id`), then deploy the rules:
   ```bash
   npx firebase login
   npm run deploy:rules
   ```
7. **Authentication → Settings → Authorized domains:** `localhost` and `your-project.web.app` are added automatically. Add any custom domain you use for the PWA.

## 3. Run against the real project
```bash
npm run dev:desktop   # Electron
npm run dev:web       # (optional) desktop UI in a browser at http://localhost:5173
npm run dev:mobile    # PWA at http://localhost:3000
```
Sign up in either app, then log in with the same account in the other. Changes sync in real time.

## 4. Build the desktop installers

```bash
npm run dist:win      # → packages/desktop/release/LifeTracker-1.0.0-win-x64.exe (installer) + portable .exe
npm run dist:mac      # → LifeTracker-1.0.0-mac-x64.dmg and -arm64.dmg
npm run dist:linux    # → LifeTracker-1.0.0-linux-x86_64.AppImage and -amd64.deb
```
- The Firebase config from `packages/desktop/.env.local` is built into the app at build time.
- Build each OS on that OS (a macOS `.dmg` needs macOS). Windows builds can also be made on Linux if Wine is installed. The easiest way to get all three is the GitHub Actions workflow below.
- **Code signing (optional but recommended for public distribution):**
  - Windows: set `CSC_LINK`/`CSC_KEY_PASSWORD` to your `.pfx` certificate.
  - macOS: set `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID` for signing and notarisation. See the electron-builder code-signing docs.
  - Without signing:
    - Windows shows *"Windows protected your PC"*: click **More info → Run anyway**.
    - macOS: right-click the app → **Open** the first time, or run `xattr -dr com.apple.quarantine /Applications/LifeTracker.app`.
- Linux: `chmod +x LifeTracker-*.AppImage && ./LifeTracker-*.AppImage`, or `sudo apt install ./LifeTracker-*.deb`.

### Automated releases (GitHub Actions)
1. Make sure the Firebase config in `packages/desktop/.env` is the project you want the installers to use. No GitHub secrets are needed for unsigned builds.
2. Tag a version and push it:
   ```bash
   git tag v1.0.0 && git push origin v1.0.0
   ```
3. `.github/workflows/release.yml` builds on Windows, macOS and Linux and attaches the `.exe`, `.dmg`, `.AppImage` and `.deb` files to a GitHub Release. Anyone can download them from `https://github.com/<you>/<repo>/releases/latest`, then sign up in the app.

## 5. Deploy the mobile PWA (Firebase Hosting)
```bash
npm run deploy:mobile     # builds packages/mobile and runs: firebase deploy --only hosting
```
The app is then available at `https://your-project.web.app`. On the phone:
- **Android (Chrome):** open the URL, then use the menu → *Install app*. The in-app account menu also has an **Install app** button.
- **iOS (Safari 16.4+):** open the URL, then Share → **Add to Home Screen**. Background notifications and the icon badge need the installed web app on iOS.

To deploy automatically on every push to `main`, add a `FIREBASE_SERVICE_ACCOUNT` repository secret. Its value is the JSON key of a Google Cloud service account with the **Firebase Admin** and **API Keys Viewer** roles (Google Cloud console → IAM & Admin → Service accounts → Create → add both roles → Keys → Add key → JSON). `.github/workflows/deploy-mobile.yml` then builds and deploys the PWA, the Firestore rules and the indexes. You can also run it manually from the Actions tab.

## 6. Useful scripts (run from the repo root)
| Script | What it does |
| --- | --- |
| `npm test` | Unit tests for the timer, reports, LWW merge, sync queue and store |
| `npm run dev:desktop` | Vite + Electron with hot reload |
| `npm run dev:web` | Desktop UI in the browser only |
| `npm run dev:mobile` | PWA dev server |
| `npm run build:desktop` / `build:mobile` | Production web builds |
| `npm run dist:win` / `dist:mac` / `dist:linux` | Desktop installers |
| `npm run emulators` | Local Auth + Firestore emulators |
| `npm run deploy:rules` | Deploy Firestore rules and indexes |
| `npm run deploy:mobile` | Build and deploy the PWA to Firebase Hosting |

## 7. Troubleshooting
- **"Firebase is not configured" screen:** `.env.local` is missing or incomplete. Restart the dev server or rebuild after editing it.
- **`auth/operation-not-allowed`:** the Email/Password provider is not enabled (step 2.2).
- **Changes stay "Pending" or show "Sync error":** check that the rules are deployed (`npm run deploy:rules`) and that the device clock is correct. Writes the rules reject are dropped from the queue and logged in the console.
- **The mobile app shows an old version:** the service worker updates in the background, and the app shows a *"new version available — tap to update"* banner.
- **Electron on Linux fails with a sandbox error when run from source:** run `npm start -w @lifetracker/desktop -- --no-sandbox`, or fix the permissions of `chrome-sandbox`.
