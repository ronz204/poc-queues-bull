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

export interface IExecutionStore {
	create(execution: Execution): Promise<void>;

	update(execution: Execution): Promise<void>;

	findById(id: ExecutionId): Promise<Execution | null>;

	findByIdempotencyKey(key: ExecutionIdempotencyKey): Promise<Execution | null>;

	listByDefinition(definitionId: DefinitionId): Promise<Execution[]>;
}
