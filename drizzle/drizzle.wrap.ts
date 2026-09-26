import type { Executor } from "@drizz/database/helpers/executor.helper";
import { translateViolation } from "@drizz/database/helpers/violation.helper";
import { type Container, type Token, token } from "dockdi";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

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
			throw translateViolation(error);
		}
	}

	close() {
		return this.sql.end();
	}
}
