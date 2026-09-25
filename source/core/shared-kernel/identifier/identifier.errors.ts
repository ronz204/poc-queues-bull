export class InvalidIdentifierError extends Error {
	constructor(
		readonly kind: string,
		readonly value: string,
		cause?: unknown,
	) {
		super(`"${value}" is not a valid ${kind}`, { cause });
		this.name = "InvalidIdentifierError";
	}
}
