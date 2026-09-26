import type { Page, Range, Slice } from "@core/shared-kernel";
import type { DefinitionId } from "../definition/definition.vos";
import type { Execution } from "./execution.aggregate";
import type { ExecutionStatus, TriggerType } from "./execution.enums";
import type { ExecutionId } from "./execution.vos";

export interface ExecutionFilter {
	readonly definitionId: DefinitionId;
	readonly status?: ExecutionStatus;
	readonly triggerType?: TriggerType;
	readonly scheduledFor?: Range<Date>;
}

export interface ExecutionCursor {
	readonly scheduledFor: Date;
	readonly id: ExecutionId;
}

export interface ExecutionDigest {
	readonly id: ExecutionId;
	readonly status: ExecutionStatus;
	readonly triggerType: TriggerType;
	readonly definitionVersion: number;
	readonly scheduledFor: Date;
	readonly startedAt: Date | null;
	readonly finishedAt: Date | null;
	readonly workerId: string | null;
	readonly errorMessage: string | null;
}

export interface ExecutionSummary {
	readonly last: ExecutionDigest | null;
	readonly lastSucceeded: ExecutionDigest | null;
	readonly lastFailed: ExecutionDigest | null;
}

export interface ExecutionCreation {
	readonly execution: Execution;
	readonly created: boolean;
}

export interface IExecutionRepository {
	createIfAbsent(execution: Execution): Promise<ExecutionCreation>;

	update(execution: Execution): Promise<void>;

	findById(id: ExecutionId): Promise<Execution | null>;

	list(
		filter: ExecutionFilter,
		page: Page<ExecutionCursor>,
	): Promise<Slice<ExecutionDigest, ExecutionCursor>>;

	summarizeByDefinitions(definitionIds: DefinitionId[]): Promise<Map<string, ExecutionSummary>>;
}
