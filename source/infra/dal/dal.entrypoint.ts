import type { Executor } from "@db/helpers/executor.helper";
import { type Container, type Token, token } from "dockdi";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { toPersistenceError } from "./dal.classifier";

export const TxToken = token<Executor>("Tx");

export class Drizzler {
	private readonly sql: postgres.Sql;
	private readonly db: Executor;

	constructor(
		private readonly container: Container,
		connectionUrl: string,
	) {
		this.sql = postgres(connectionUrl);
		this.db = drizzle({ client: this.sql });
	}

	async run<S, R>(entry: Token<S>, work: (service: S) => Promise<R>): Promise<R> {
		try {
			return await this.db.transaction((tx) => {
				const scope = this.container.scope();
				scope.bind(TxToken).toValue(tx);
				return work(scope.resolve(entry));
			});
		} catch (error) {
			throw toPersistenceError(error);
		}
	}

	close() {
		return this.sql.end();
	}
}
