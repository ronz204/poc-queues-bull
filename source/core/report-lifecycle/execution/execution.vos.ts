import { assertUuid, UniqueUUID } from "@core/common-domain";

export class ReportExecutionId extends UniqueUUID {
	public static from(value: string): ReportExecutionId {
		assertUuid(value, "ReportExecutionId");
		return new ReportExecutionId(value);
	}
}

// The computed result's shape depends on the owning definition's aggregationType/groupBy
// (see report-definition.enums.ts) — left as unknown here since no consumer decodes it yet.
export class ReportSnapshot {
	private constructor(
		readonly result: unknown,
		readonly fencingToken: number,
	) {}

	public static from(result: unknown, fencingToken: number): ReportSnapshot {
		return new ReportSnapshot(result, fencingToken);
	}
}
