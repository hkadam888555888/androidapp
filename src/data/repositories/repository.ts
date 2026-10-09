import type { ID } from '../../domain/entities/models';

export interface Repository<T extends { id: ID }> {
  get(id: ID): Promise<T | undefined>;
  list(): Promise<T[]>;
  put(value: T): Promise<void>;
  putMany(values: T[]): Promise<void>;
  delete(id: ID): Promise<void>;
}
