import { InvalidIdentifierError } from "./identifier.errors";

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUuid(value: string, kind: string): void {
	if (!UUID_PATTERN.test(value)) throw new InvalidIdentifierError(kind, value);
}

export abstract class UniqueUUID {
	protected constructor(readonly value: string) {}

	public equals(other: UniqueUUID): boolean {
		return this.constructor === other.constructor && this.value === other.value;
	}
}
