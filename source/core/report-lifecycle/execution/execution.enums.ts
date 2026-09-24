export type ExecutionStatus = "pending" | "running" | "succeeded" | "failed";

export const EXECUTION_STATUSES: readonly ExecutionStatus[] = [
	"pending",
	"running",
	"succeeded",
	"failed",
];

export type TriggerType = "cron" | "manual";

export const TRIGGER_TYPES: readonly TriggerType[] = ["cron", "manual"];
