import type { DomainEvent } from "@core/shared-kernel";
import type { ReportSnapshot } from "./execution.vos";

export class ExecutionSucceededEvent implements DomainEvent {
	readonly type = "execution.succeeded" as const;

	constructor(
		readonly executionId: string,
		readonly definitionId: string,
		readonly definitionVersion: number,
		readonly snapshot: ReportSnapshot,
		readonly occurredAt: Date,
	) {}

	get aggregateId(): string {
		return this.executionId;
	}
}

export class ExecutionFailedEvent implements DomainEvent {
	readonly type = "execution.failed" as const;

	constructor(
		readonly executionId: string,
		readonly definitionId: string,
		readonly errorMessage: string,
		readonly occurredAt: Date,
	) {}

	get aggregateId(): string {
		return this.executionId;
	}
}
