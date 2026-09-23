import type { ExecutionStatus } from "./report-execution.enums";

export class InvalidExecutionTransitionError extends Error {
	constructor(
		readonly from: ExecutionStatus,
		readonly to: ExecutionStatus,
	) {
		super(`report execution cannot transition from "${from}" to "${to}"`);
		this.name = "InvalidExecutionTransitionError";
	}
}
