import type { Db, DrizzleClient } from "./drizzle.client";

export interface UnitOfWork {
	run<T>(work: (db: Db) => Promise<T>): Promise<T>;
}

export class DrizzleUnitOfWork implements UnitOfWork {
	constructor(private readonly client: DrizzleClient) {}

	run<T>(work: (db: Db) => Promise<T>) {
		return this.client.db.transaction((tx) => work(tx));
	}
}
