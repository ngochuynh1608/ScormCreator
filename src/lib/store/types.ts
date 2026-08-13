/**
 * Document-oriented store API — intentionally Mongo-like so a future
 * MongoDatabaseStore can swap in without rewriting call sites.
 */
export type DocumentStore = {
  list<T extends { id: string }>(collection: string): Promise<T[]>;
  get<T extends { id: string }>(
    collection: string,
    id: string,
  ): Promise<T | null>;
  put<T extends { id: string }>(collection: string, doc: T): Promise<T>;
  putMany<T extends { id: string }>(
    collection: string,
    docs: T[],
  ): Promise<void>;
  delete(collection: string, id: string): Promise<boolean>;
  replaceAll<T extends { id: string }>(
    collection: string,
    docs: T[],
  ): Promise<void>;
  /** Opaque key/value for migration flags, etc. */
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
};

export const COLLECTIONS = {
  users: "users",
  plans: "plans",
  usage: "usage",
  settings: "settings",
  jobs: "jobs",
  creditPacks: "creditPacks",
  creditOrders: "creditOrders",
  creditTransactions: "creditTransactions",
  planOrders: "planOrders",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
