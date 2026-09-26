export type PersistenceErrorKind =
	| "unique"
	| "foreign_key"
	| "not_null"
	| "check"
	| "exclusion"
	| "invalid_input"
	| "contention"
	| "timeout"
	| "unavailable";

const RETRYABLE_KINDS: ReadonlySet<PersistenceErrorKind> = new Set([
	"contention",
	"timeout",
	"unavailable",
]);

export class PersistenceError extends Error {
	readonly retryable: boolean;

	constructor(
		readonly kind: PersistenceErrorKind,
		readonly constraint: string | null,
		cause: unknown,
	) {
		super(`${kind} persistence failure${constraint ? ` on ${constraint}` : ""}`, { cause });
		this.name = "PersistenceError";
		this.retryable = RETRYABLE_KINDS.has(kind);
	}
}
