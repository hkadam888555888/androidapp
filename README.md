# My Adaptive Routine

A local-first routine planner that turns a learning roadmap and real-life constraints into a day plan you can act on.

## What it does

- Import a roadmap from Markdown or plain text, review the parsed hierarchy, and approve the curriculum before it becomes schedulable work.
- Create learning and practice tasks from topic names and their parent sections. Topic context matters: "Arrays" under NumPy is treated as data work, while "Arrays" under Python is treated as programming work.
- Build a day plan from study windows, capacity limits, busy blocks, priorities, prerequisites, external work, and enabled habits.
- Record task outcomes explicitly. A timer ending is not a completion; Complete, Partial, Skip, and review remain distinct user decisions.
- Track exercise and water entries, calendar history, reviews, and planning decisions.
- Keep routine records in the browser's IndexedDB database on the device. An account or cloud AI key is not required for deterministic planning.

## AI and privacy boundary

Roadmap parsing, validation, curriculum compilation, and scheduling are deterministic local application logic. The default provider is a rule-based provider; the app is not LLM-powered by default. An OpenAI-compatible local model can be selected explicitly and must be configured with a supported loopback endpoint. A missing or invalid endpoint is reported instead of silently pretending that a model is connected. Cloud AI is not enabled by this project configuration.

The web app can deliver reminders only while it is open. The Android build includes the local-notifications integration, but background delivery, Android permission flows, battery/Doze behavior, notification taps, and accessibility must be verified on physical devices before release.

## Development

Requirements: Node.js 22.12+ and npm 10.9.2+.

```bash
npm ci
npm run dev
```

## Verification

```bash
npm run audit:source
npm run security:arena100
npm run lint
npm test
npm run build
npx playwright install chromium
npx playwright test
npm audit --audit-level=high
```

The GitHub Actions workflows run the web verification and produce a debug APK artifact. The Android job uses Node 22.16.0 and exact Capacitor 8.5.2 package versions, checks the resolved versions, and uploads the resolved npm dependency tree alongside the APK. A CI APK build is not a signed release and does not replace physical-device QA.

## Release status

Do not treat a green CI run as proof that the app is release-ready. The Android CI job pins the direct Capacitor packages and captures the resolved dependency tree for each build; the Android project is still generated during CI rather than checked in as a native project. Before publishing, install the APK on supported physical devices and verify first-run setup, existing-data upgrades, Android 13+ notification permission, reminders with the app closed, Doze/battery behavior, notification navigation, Back behavior, TalkBack, contrast, and responsive layouts. No production signing key, store release, or deployment is included.
