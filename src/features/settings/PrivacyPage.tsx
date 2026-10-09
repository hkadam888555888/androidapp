import { Link } from 'react-router-dom';

export function PrivacyPage() {
  return <section className="page privacy-page">
    <header className="page-header">
      <div>
        <p className="eyebrow">My Adaptive Routine · v1.0.5</p>
        <h1>Privacy & data handling</h1>
        <p className="muted">This notice describes the behavior of this application build.</p>
      </div>
      <Link className="button secondary" to="/settings">Back to settings</Link>
    </header>

    <article className="card privacy-copy">
      <h2>Data stored on this device</h2>
      <p>Routine preferences, roadmaps, planned tasks, results, habit logs, analytics, notification records, AI artifacts, and audit records are stored in this browser's IndexedDB database. This build does not require an account and does not send this data to a My Adaptive Routine server.</p>

      <h2>AI processing</h2>
      <p>The deterministic rule-based provider is the default and runs locally. The optional OpenAI-compatible adapter only accepts loopback addresses (localhost, 127.0.0.1, or ::1) and sends requests to that local model server. A local server is separate software; review its own behavior and keep it bound to loopback. Cloud AI is disabled in this build.</p>

      <h2>Backups and deletion</h2>
      <p>Exported JSON backups may contain personal routine and progress information. You choose where to save or share them; the app does not upload them automatically. Importing a backup replaces the app's stored records. “Delete all local data” clears the app's local records in this browser and returns setup to its first-run state. It does not delete backup files that you saved outside the app.</p>

      <h2>Notifications</h2>
      <p>Browser reminders are optional and require notification permission. Delivery is foreground-only in this release: reminders are not guaranteed while the app is closed, suspended, or the browser is stopped.</p>

      <h2>Analytics and diagnostics</h2>
      <p>This build does not include a third-party analytics SDK or remote crash-reporting service. The diagnostics view is local to the app. If you share an exported backup or diagnostic information yourself, that sharing happens outside the app's automatic data flow.</p>

      <h2>Limits of this notice</h2>
      <p>This in-app notice documents the current implementation; it is not a claim that the application is already approved for an app store or hosted under a particular service's privacy policy. A public, hosted privacy-policy URL and jurisdiction-specific review may still be required before distribution.</p>
    </article>
  </section>;
}
