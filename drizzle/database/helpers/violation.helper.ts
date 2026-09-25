import { DrizzleQueryError } from "drizzle-orm";

const UNIQUE_VIOLATION = "23505";

interface PostgresErrorShape {
	code?: string;
	constraint_name?: string;
}

export const isUniqueViolation = (error: unknown, constraint: string): boolean => {
	if (!(error instanceof DrizzleQueryError)) return false;
	const cause = error.cause as PostgresErrorShape | undefined;
	return cause?.code === UNIQUE_VIOLATION && cause.constraint_name === constraint;
};
