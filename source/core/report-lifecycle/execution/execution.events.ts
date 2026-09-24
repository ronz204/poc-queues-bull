import type { ReportSnapshot } from "./execution.vos";

export class ExecutionSucceededEvent {
	readonly type = "execution.succeeded" as const;

	constructor(
		readonly executionId: string,
		readonly definitionId: string,
		readonly definitionVersion: number,
		readonly snapshot: ReportSnapshot,
		readonly occurredAt: Date,
	) {}
}

export class ExecutionFailedEvent {
	readonly type = "execution.failed" as const;

	constructor(
		readonly executionId: string,
		readonly definitionId: string,
		readonly errorMessage: string,
		readonly occurredAt: Date,
	) {}
}
