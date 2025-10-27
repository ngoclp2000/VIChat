declare module 'mongodb' {
  export class MongoClient {
    constructor(uri: string, options?: Record<string, unknown>);
    connect(): Promise<MongoClient>;
    close(): Promise<void>;
    db(name: string): Db;
  }

  export interface Db {
    collection<T>(name: string): Collection<T>;
  }

  export interface Collection<T> {
    findOne(filter: Record<string, unknown>): Promise<T | null>;
    insertOne(document: T): Promise<{ acknowledged: boolean }>;
    updateOne(
      filter: Record<string, unknown>,
      update: Record<string, unknown>,
      options?: Record<string, unknown>
    ): Promise<{ acknowledged: boolean }>;
    find(filter: Record<string, unknown>): Cursor<T>;
  }

  export interface Cursor<T> {
    sort(sort: Record<string, 1 | -1>): Cursor<T>;
    limit(limit: number): Cursor<T>;
    project(projection: Record<string, unknown>): Cursor<T>;
    toArray(): Promise<T[]>;
  }

  export class ObjectId {
    constructor(id?: string);
  }

  export type WithId<T> = T & { _id: string };
}
