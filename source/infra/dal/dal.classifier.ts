import { DrizzleQueryError } from "drizzle-orm";
import postgres from "postgres";
import { PersistenceError, type PersistenceErrorKind } from "./dal.exceptions";

const SQLSTATE_KINDS: Readonly<Record<string, PersistenceErrorKind>> = {
	"23505": "unique",
	"23503": "foreign_key",
	"23502": "not_null",
	"23514": "check",
	"23P01": "exclusion",
	"22P02": "invalid_input",
	"22001": "invalid_input",
	"22003": "invalid_input",
	"22007": "invalid_input",
	"22008": "invalid_input",
	"40001": "contention",
	"40P01": "contention",
	"55P03": "contention",
	"57014": "timeout",
	"57P01": "unavailable",
	"57P03": "unavailable",
	"08": "unavailable",
	"53": "unavailable",
};

const CONNECTION_CODES: ReadonlySet<string> = new Set([
	"CONNECTION_CLOSED",
	"CONNECTION_ENDED",
	"CONNECTION_DESTROYED",
	"CONNECT_TIMEOUT",
	"ECONNREFUSED",
	"ECONNRESET",
	"ETIMEDOUT",
	"ENOTFOUND",
	"EPIPE",
]);

export const toPersistenceError = (error: unknown): unknown => {
	if (error instanceof PersistenceError) return error;

	const source = error instanceof DrizzleQueryError ? error.cause : error;

	if (source instanceof postgres.PostgresError) {
		const kind = SQLSTATE_KINDS[source.code] ?? SQLSTATE_KINDS[source.code.slice(0, 2)];
		return kind ? new PersistenceError(kind, source.constraint_name ?? null, error) : error;
	}

	const code = (source as { code?: unknown } | undefined)?.code;
	return typeof code === "string" && CONNECTION_CODES.has(code)
		? new PersistenceError("unavailable", null, error)
		: error;
};
