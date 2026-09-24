import { DrizzleQueryError } from "drizzle-orm/errors";
import postgres from "postgres";

const UNIQUE_VIOLATION = "23505";

export function isUniqueViolation(error: unknown, constraint: string): boolean {
	const cause = error instanceof DrizzleQueryError ? error.cause : error;
	return (
		cause instanceof postgres.PostgresError &&
		cause.code === UNIQUE_VIOLATION &&
		cause.constraint_name === constraint
	);
}
