# LifeTracker

**A cross-platform productivity tracker.** Plan your day as tasks with time estimates, track the time you really spend on each one, and get daily reports on how the day went. The desktop app runs on Windows, macOS and Linux. A mobile companion (an installable PWA) keeps your phone in sync through Firebase, and both apps keep working offline.

| Desktop — tasks & timer | Desktop — daily report | Mobile — now | Mobile — today |
| --- | --- | --- | --- |
| <img src="docs/screenshots/desktop-tasks.png" width="320"> | <img src="docs/screenshots/desktop-reports.png" width="320"> | <img src="docs/screenshots/mobile-now.png" width="140"> | <img src="docs/screenshots/mobile-summary.png" width="140"> |

## Features

### Desktop app (Electron + React + Vite)
- **Accounts:** email/password sign-up, login and password reset with Firebase Auth. Each user's data is stored separately and only they can read it (enforced by Firestore rules).
- **Tasks:** add a task with a title and an estimate (with presets for 15m to 3h). You can edit inline (double-click), delete, and mark tasks complete or incomplete. Status chips show *To do / Running / Paused / Over / Done*, and filters show *Today / Open / Completed / Earlier*.
- **Timer:**
  - Each task has its own timer, and you start or pause it with one click. Only one timer runs at a time, so starting a new one pauses the current one.
  - The running task gets a large `HH:MM` display (seconds shown smaller), a bar for estimate vs actual, and the time remaining or over.
  - The timer state is saved (`runningSince` plus the recorded sessions). It keeps counting across restarts and between devices.
  - An optional **auto-start next task** setting starts the next task when you complete one.
- **Daily reports:**
  - Tasks completed today, hours worked, and a **productivity score** (completed / total).
  - **Efficiency %** (estimated / actual time for finished tasks).
  - A daily goal ring, a chart of the last 7 days, and a table of estimated vs actual time per task.
  - A **motivational message** picked from a curated list to match how your day is going (the shuffle button picks another).
- **Midnight reset:** time is recorded as sessions, so hours are counted on the right calendar day even when a timer runs past midnight. At midnight the day's summary is saved and unfinished tasks move to the new day (you can turn this off).
- **Notifications (in-app plus OS):**
  - Task completed ✓.
  - Time warning when **1 hour** is left on a task (for short tasks, 25% of the estimate).
  - Alert when a task goes over its estimate.
  - Daily goal reached 🎉 and all tasks done 🏆.
  - A daily summary at the hour you choose.
  - A notification centre with an unread badge (also shown on the dock or taskbar).
- **Sync:** live Firestore listeners, instant (optimistic) UI updates, last-write-wins conflict resolution, and a sync status indicator.

### Mobile companion (React PWA, create-react-app + Workbox)
- Log in with the same account.
- See the running task with a live timer, and pause or resume it with **one tap**.
- Today's task list with tap-to-start, tap-to-complete and quick add.
- Today's summary: goal ring, completed tasks, hours, score, efficiency and a motivational message.
- In-app toasts, an **Alerts** tab with a badge count, and an app-icon badge (`navigator.setAppBadge`) where the device supports it.
- Installable ("Add to Home Screen"). The app shell is precached, so it opens and works offline.
- Changes sync automatically with the desktop app in both directions.

### Offline support
Every change is applied to the UI right away and saved to `localStorage` in two places:
1. **A cache** of tasks, settings and notifications, so the app opens with your data even when offline.
2. **A sync queue** with one entry per document. Repeated edits to the same document merge into one entry, and the queue survives restarts.

When the device is back online (the `online` event, the app becoming visible, or a retry with backoff), the queue is sent to Firestore. Each write goes through a transaction that only replaces the server copy if the incoming `updatedAt` is newer (last-write-wins), and the Firestore rules enforce the same check on the server. Deletions are stored as "deleted" markers (tombstones), so they sync with the same rules.

## Project structure

```
productivity-tracker/
├── packages/
│   ├── desktop/          Electron + React (Vite, Tailwind)
│   │   ├── electron/     main process (app:// protocol, notifications, badge) + preload bridge
│   │   └── src/          renderer UI
│   ├── mobile/           React PWA (create-react-app, Tailwind, Workbox service worker)
│   └── shared/           Firebase setup, Zustand store, timer/report/sync logic + unit tests
├── firebase/             Firestore security rules + indexes
├── .github/workflows/    CI, desktop installers (release), PWA deploy
├── firebase.json         Hosting (PWA) + emulator config
├── package.json          npm workspaces monorepo
├── SETUP.md              step-by-step setup, build & deploy guide
└── README.md
```

## Quick start

```bash
npm install
npm test                      # shared core unit tests

# Try everything locally without a Firebase project (needs Java 11+):
npm run emulators             # terminal 1 — Auth + Firestore emulators
echo "VITE_FIREBASE_EMULATOR_HOST=127.0.0.1" > packages/desktop/.env.local
echo "REACT_APP_FIREBASE_EMULATOR_HOST=127.0.0.1" > packages/mobile/.env.local
npm run dev:desktop           # terminal 2 — Electron app with hot reload
npm run dev:mobile            # terminal 3 — PWA at http://localhost:3000
```

For a real Firebase project, building the installers and deploying the PWA, see **[SETUP.md](SETUP.md)**.

## Firestore data model

```
users/{uid}                         { email, displayName, createdAt }
users/{uid}/tasks/{taskId}          { id, title, estimatedHours, completed, completedAt,
                                      date: "YYYY-MM-DD", sessions: [{start, end}], baseMs,
                                      runningSince, createdAt, updatedAt, deleted, deviceId, carriedFrom? }
users/{uid}/summaries/{YYYY-MM-DD}  { totalTasks, completedTasks, hoursWorked, estimatedHours,
                                      productivityScore, efficiency, goalHours, goalReached, updatedAt }
users/{uid}/meta/settings           { displayName, dailyGoalHours, summaryHour, carryOver,
                                      autoStartNext, systemNotifications, updatedAt }
```

Times are epoch milliseconds. The security rules are in [`firebase/firestore.rules`](firebase/firestore.rules). Users can read and write only their own documents, every field is validated, and an update is refused if it would replace a newer version with an older one.

## How the numbers are calculated

| Metric | Formula |
| --- | --- |
| Hours worked | Sum of all tracked session time that falls inside the day (a running timer counts up to now) |
| Productivity score | completed tasks ÷ tasks for the day × 100 |
| Efficiency | Σ estimate ÷ Σ actual time for finished tasks × 100 (100% = on estimate, >100% = faster) |
| Goal progress | hours worked ÷ daily goal (set in Settings, default 6h) |

"Tasks for the day" means tasks planned for that date, plus tasks completed or worked on that day.

## Tech stack
React 18 · Electron · Vite · create-react-app (PWA) · Workbox · Firebase Auth + Firestore · Zustand · Tailwind CSS · lucide icons · Vitest · electron-builder

## Known limitations
- Last-write-wins uses each device's clock. If a device's clock is badly wrong, its edits can win or lose unexpectedly.
- Notifications only fire while an app is open (in the foreground or background). There is no server push, by design: no external services are used.
- The installers are unsigned unless you add code-signing certificates. Windows SmartScreen and macOS Gatekeeper will show a warning the first time the app is opened (see SETUP.md).
