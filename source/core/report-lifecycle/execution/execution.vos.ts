import { assertUuid, UniqueUUID } from "@core/common-domain";

export class ExecutionId extends UniqueUUID {
	public static from(value: string): ExecutionId {
		assertUuid(value, "ExecutionId");
		return new ExecutionId(value);
	}
}

// The computed result's shape depends on the owning definition's aggregationType/groupBy
// (see definition.enums.ts) — left as unknown here since no consumer decodes it yet.
export class ReportSnapshot {
	private constructor(
		readonly result: unknown,
		readonly fencingToken: number,
	) {}

	public static from(result: unknown, fencingToken: number): ReportSnapshot {
		return new ReportSnapshot(result, fencingToken);
	}
}
