import { assertUuid, UniqueUUID } from "@core/shared-kernel";

export class ExecutionId extends UniqueUUID {
	public static from(value: string): ExecutionId {
		assertUuid(value, "ExecutionId");
		return new ExecutionId(value);
	}
}

export class ReportSnapshot {
	private constructor(
		readonly result: unknown,
		readonly fencingToken: number,
	) {}

	public static from(result: unknown, fencingToken: number): ReportSnapshot {
		return new ReportSnapshot(result, fencingToken);
	}
}
