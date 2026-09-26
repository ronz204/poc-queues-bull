import type { DefinitionId } from "../definition/definition.vos";
import type { Execution } from "./execution.aggregate";
import type { TriggerType } from "./execution.enums";
import type { ExecutionId } from "./execution.vos";

export interface ExecutionIdempotencyKey {
	definitionId: DefinitionId;
	definitionVersion: number;
	triggerType: TriggerType;
	scheduledFor: Date;
}

// Keyset position in a definition's history: scheduledFor alone isn't unique (a cron and a
// manual run, or two versions, can share a tick), so the id breaks the tie.
export interface ExecutionCursor {
	scheduledFor: Date;
	id: ExecutionId;
}

export interface ExecutionPage {
	limit: number;
	after?: ExecutionCursor;
}

export interface ExecutionSummary {
	last: Execution | null;
	lastSucceeded: Execution | null;
	lastFailed: Execution | null;
}

export interface IExecutionStore {
	create(execution: Execution): Promise<void>;

	update(execution: Execution): Promise<void>;

	findById(id: ExecutionId): Promise<Execution | null>;

	findByIdempotencyKey(key: ExecutionIdempotencyKey): Promise<Execution | null>;

	// Newest first, ordered by (scheduledFor, id) descending.
	listByDefinition(definitionId: DefinitionId, page: ExecutionPage): Promise<Execution[]>;

	// Keyed by the definition id's string value; every requested id gets an entry, empty when
	// the definition has never run.
	summarizeByDefinitions(definitionIds: DefinitionId[]): Promise<Map<string, ExecutionSummary>>;
}
