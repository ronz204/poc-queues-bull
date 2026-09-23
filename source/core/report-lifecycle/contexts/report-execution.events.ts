import type { ReportSnapshot } from "./report-execution.vos";

export class ReportExecutionSucceededEvent {
	readonly type = "report-execution.succeeded" as const;

	constructor(
		readonly reportExecutionId: string,
		readonly reportDefinitionId: string,
		readonly reportDefinitionVersion: number,
		readonly snapshot: ReportSnapshot,
		readonly occurredAt: Date,
	) {}
}

export class ReportExecutionFailedEvent {
	readonly type = "report-execution.failed" as const;

	constructor(
		readonly reportExecutionId: string,
		readonly reportDefinitionId: string,
		readonly errorMessage: string,
		readonly occurredAt: Date,
	) {}
}
