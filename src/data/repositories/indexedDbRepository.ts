import type { IDBPDatabase } from 'idb';
import type { ID } from '../../domain/entities/models';
import type { AppDatabaseSchema } from '../db/schema';
import type { Repository } from './repository';

export class IndexedDbRepository<T extends { id: ID }, K extends keyof AppDatabaseSchema & string> implements Repository<T> {
  constructor(private readonly getDb: () => Promise<IDBPDatabase<AppDatabaseSchema>>, private readonly storeName: K) {}

  async get(id: ID): Promise<T | undefined> {
    const db = await this.getDb();
    return db.get(this.storeName, id) as Promise<T | undefined>;
  }

  async list(): Promise<T[]> {
    const db = await this.getDb();
    return (await db.getAll(this.storeName)) as unknown as T[];
  }

  async put(value: T): Promise<void> {
    const db = await this.getDb();
    await db.put(this.storeName, value as unknown as AppDatabaseSchema[K]);
  }

  async putMany(values: T[]): Promise<void> {
    if (values.length === 0) return;
    const db = await this.getDb();
    const tx = db.transaction(this.storeName, 'readwrite');
    for (const value of values) await tx.store.put(value as unknown as AppDatabaseSchema[K]);
    await tx.done;
  }

  async delete(id: ID): Promise<void> {
    const db = await this.getDb();
    await db.delete(this.storeName, id);
  }
}
