import type { ExecutionStatus, TriggerType } from "./report-execution.enums";

export interface TriggerReportExecutionProps {
	id: string;
	reportDefinitionId: string;
	reportDefinitionVersion: number;
	triggerType: TriggerType;
	scheduledFor: Date;
}

export interface ReportExecutionSnapshotProps {
	id: string;
	reportDefinitionId: string;
	reportDefinitionVersion: number;
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
