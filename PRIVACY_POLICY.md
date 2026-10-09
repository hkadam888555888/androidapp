# My Adaptive Routine — Privacy and Data Handling Notice

**Applies to:** v1.0.5 source build. **Last reviewed:** 2026-10-09.

## Local storage

The application stores routine preferences, roadmaps, tasks, task results, habits, habit logs, planner data, notification records, AI artifacts, and audit records in the browser's IndexedDB database on the device where it is used. The application does not require an account and this build does not send those records to a My Adaptive Routine server.

## AI processing

The default AI provider is a deterministic rule-based implementation that runs locally. The optional OpenAI-compatible adapter accepts loopback addresses only (`localhost`, `127.0.0.1`, or `::1`) and sends requests to the selected local model server. That server is separate software and may have its own behavior. Cloud AI is disabled in this build.

## Export, import, and deletion

JSON backups may contain personal routine and progress information. Users choose where to store or share exported files; the app does not upload them automatically. Importing a backup replaces locally stored app records. The “Delete all local data” control clears the app's local records in that browser and returns onboarding to its first-run state; it does not remove backup files saved outside the app.

## Notifications

Browser reminders are optional and require permission. Delivery is foreground-only in this release and is not guaranteed while the app is closed, suspended, or the browser is stopped.

## Analytics and diagnostics

This source build does not include a third-party analytics SDK or remote crash-reporting service. Its diagnostics view is local to the app. Information exported or shared by the user is outside the app's automatic data flow.

## Distribution note

This document describes the source build and is not a substitute for a publicly hosted privacy-policy URL, app-store disclosures, or jurisdiction-specific legal review. Distribution owners must review this notice against the actual hosting, packaging, and telemetry configuration before release.
