import type { ExecutionStatus, TriggerType } from "./execution.enums";
import { InvalidExecutionTransitionError } from "./execution.errors";
import { ExecutionFailedEvent, ExecutionSucceededEvent } from "./execution.events";
import type { ExecutionSnapshotProps, TriggerExecutionProps } from "./execution.types";
import { ExecutionId, type ReportSnapshot } from "./execution.vos";

type ExecutionSucceedResult = {
	execution: Execution;
	event: ExecutionSucceededEvent;
};
type ExecutionFailResult = { execution: Execution; event: ExecutionFailedEvent };

export class Execution {
	readonly id: ExecutionId;
	readonly definitionId: string;
	readonly definitionVersion: number;
	readonly triggerType: TriggerType;
	readonly scheduledFor: Date;
	readonly status: ExecutionStatus;
	readonly workerId: string | null;
	readonly fencingToken: number | null;
	readonly result: unknown;
	readonly errorMessage: string | null;
	readonly startedAt: Date | null;
	readonly finishedAt: Date | null;
	readonly createdAt: Date;

	private constructor(props: ExecutionSnapshotProps) {
		this.id = ExecutionId.from(props.id);
		this.definitionId = props.definitionId;
		this.definitionVersion = props.definitionVersion;
		this.triggerType = props.triggerType;
		this.scheduledFor = props.scheduledFor;
		this.status = props.status;
		this.workerId = props.workerId;
		this.fencingToken = props.fencingToken;
		this.result = props.result;
		this.errorMessage = props.errorMessage;
		this.startedAt = props.startedAt;
		this.finishedAt = props.finishedAt;
		this.createdAt = props.createdAt;
	}

	public static trigger(props: TriggerExecutionProps): Execution {
		return Execution.reconstitute({
			...props,
			status: "pending",
			workerId: null,
			fencingToken: null,
			result: null,
			errorMessage: null,
			startedAt: null,
			finishedAt: null,
			createdAt: new Date(),
		});
	}

	public static reconstitute(snapshot: ExecutionSnapshotProps): Execution {
		return new Execution(snapshot);
	}

	public start(workerId: string): Execution {
		if (this.status !== "pending") {
			throw new InvalidExecutionTransitionError(this.status, "running");
		}

		return this.with({ status: "running", workerId, startedAt: new Date() });
	}

	public succeed(snapshot: ReportSnapshot): ExecutionSucceedResult {
		if (this.status !== "running") {
			throw new InvalidExecutionTransitionError(this.status, "succeeded");
		}

		const finishedAt = new Date();
		const execution = this.with({
			status: "succeeded",
			fencingToken: snapshot.fencingToken,
			result: snapshot.result,
			errorMessage: null,
			finishedAt,
		});
		const event = new ExecutionSucceededEvent(
			this.id.value,
			this.definitionId,
			this.definitionVersion,
			snapshot,
			finishedAt,
		);

		return { execution, event };
	}

	public fail(errorMessage: string): ExecutionFailResult {
		if (this.status !== "running") {
			throw new InvalidExecutionTransitionError(this.status, "failed");
		}

		const finishedAt = new Date();
		const execution = this.with({ status: "failed", errorMessage, finishedAt });
		const event = new ExecutionFailedEvent(
			this.id.value,
			this.definitionId,
			errorMessage,
			finishedAt,
		);

		return { execution, event };
	}

	// A queue-driven backoff retry of the same attempt — see report-lifecycle.spec.md Invariant 13.
	// Never adjusts definitionVersion/scheduledFor/triggerType: those stay frozen from trigger().
	public retry(): Execution {
		if (this.status !== "failed") {
			throw new InvalidExecutionTransitionError(this.status, "pending");
		}

		return this.with({ status: "pending", errorMessage: null, finishedAt: null });
	}

	public toSnapshot(): ExecutionSnapshotProps {
		return {
			id: this.id.value,
			definitionId: this.definitionId,
			definitionVersion: this.definitionVersion,
			triggerType: this.triggerType,
			scheduledFor: this.scheduledFor,
			status: this.status,
			workerId: this.workerId,
			fencingToken: this.fencingToken,
			result: this.result,
			errorMessage: this.errorMessage,
			startedAt: this.startedAt,
			finishedAt: this.finishedAt,
			createdAt: this.createdAt,
		};
	}

	private with(patch: Partial<ExecutionSnapshotProps>): Execution {
		return Execution.reconstitute({ ...this.toSnapshot(), ...patch });
	}
}
