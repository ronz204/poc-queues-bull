import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

export type Db = PostgresJsDatabase;

export class DrizzleClient {
	readonly db: Db;
	private readonly sql: Sql;

	constructor(connectionUrl: string) {
		this.sql = postgres(connectionUrl);
		this.db = drizzle({ client: this.sql });
	}

	close() {
		return this.sql.end();
	}
}
