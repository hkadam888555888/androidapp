import { openDB, type IDBPDatabase } from 'idb';
import { APP_VERSION, DB_NAME, DB_VERSION, type AppDatabaseSchema } from './schema';

let databasePromise: Promise<IDBPDatabase<AppDatabaseSchema>> | undefined;

export async function getDatabase(): Promise<IDBPDatabase<AppDatabaseSchema>> {
  if (databasePromise) return databasePromise;
  let rejectBlocked!: (reason: Error) => void;
  let wasBlocked = false;
  const blockedPromise = new Promise<never>((_resolve, reject) => { rejectBlocked = reject; });
  const opening = openDB<AppDatabaseSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      const stores: Array<keyof AppDatabaseSchema> = [
        'roadmaps', 'roadmapTasks', 'externalTasks', 'habits', 'habitLogs', 'busyEvents', 'dailyTasks',
        'waterLogs', 'exerciseLogs', 'dayPlans', 'dailyReviews', 'preferences', 'plannerSettings',
        'notifications', 'plannerDecisions', 'estimationProfiles', 'timePatternProfiles', 'plannerOverrides', 'adaptationSnapshots', 'aiArtifacts', 'aiSettings', 'audits', 'meta', 'curriculumVersions', 'curriculumConcepts', 'taskDefinitions',
      ];
      for (const store of stores) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' });
      }
      if (oldVersion < 3) {
        // v3 added dedicated curriculum storage while preserving earlier stores.
      }
      if (oldVersion < 4) {
        // v4 adds explainability records for every planning candidate.
      }
      if (oldVersion < 5) {
        // v5 adds multi-roadmap/external-task planner state and keeps all previous stores intact.
      }
      if (oldVersion < 6) {
        // v6 adds first-class habit logs while preserving existing habit definitions and history.
      }
      if (oldVersion < 7) {
        // v7 adds adaptive estimation, time-pattern learning, planner overrides, and pace snapshots.
      }
      if (oldVersion < 8) {
        // v8 adds persisted AI artifacts/settings while preserving curriculum and task history.
      }
      if (oldVersion < 9) {
        // v9 adds first-run preferences, optional notification delivery, and local provider configuration.
        // These are additive optional fields in existing records; no historical rows need rewriting.
      }
    },
    blocked() {
      wasBlocked = true;
      rejectBlocked(new Error('The routine database upgrade is blocked by another open tab. Close other tabs running this app, then reload.'));
    },
    blocking() {
      void databasePromise?.then((db) => db.close());
      databasePromise = undefined;
    },
  });
  // If a blocked open eventually succeeds after we have reported failure, close that late handle.
  void opening.then((db) => { if (wasBlocked) db.close(); }, () => undefined);
  databasePromise = Promise.race([opening, blockedPromise]).then(async (db) => {
    db.onversionchange = () => { db.close(); databasePromise = undefined; };
    await db.put('meta', { id: 'meta', schemaVersion: DB_VERSION, appVersion: APP_VERSION, updatedAt: new Date().toISOString() });
    return db;
  }).catch((error: unknown) => {
    databasePromise = undefined;
    throw error;
  });
  return databasePromise;
}
