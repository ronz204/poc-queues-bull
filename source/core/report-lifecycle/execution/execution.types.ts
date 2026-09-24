import type { ExecutionStatus, TriggerType } from "./execution.enums";

export interface TriggerExecutionProps {
	id: string;
	definitionId: string;
	definitionVersion: number;
	triggerType: TriggerType;
	scheduledFor: Date;
}

export interface ExecutionSnapshotProps {
	id: string;
	definitionId: string;
	definitionVersion: number;
	triggerType: TriggerType;
	scheduledFor: Date;
	status: ExecutionStatus;
	workerId: string | null;
	fencingToken: number | null;
	result: unknown;
	errorMessage: string | null;
	startedAt: Date | null;
	finishedAt: Date | null;
	createdAt: Date;
}
