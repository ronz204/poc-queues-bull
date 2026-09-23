import type { ExecutionStatus, TriggerType } from "./report-execution.enums";
import { InvalidExecutionTransitionError } from "./report-execution.errors";
import {
	ReportExecutionFailedEvent,
	ReportExecutionSucceededEvent,
} from "./report-execution.events";
import type {
	ReportExecutionSnapshotProps,
	TriggerReportExecutionProps,
} from "./report-execution.types";
import { ReportExecutionId, type ReportSnapshot } from "./report-execution.vos";

type ReportExecutionSucceedResult = {
	execution: ReportExecution;
	event: ReportExecutionSucceededEvent;
};
type ReportExecutionFailResult = { execution: ReportExecution; event: ReportExecutionFailedEvent };

export class ReportExecution {
	readonly id: ReportExecutionId;
	readonly reportDefinitionId: string;
	readonly reportDefinitionVersion: number;
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

	private constructor(props: ReportExecutionSnapshotProps) {
		this.id = ReportExecutionId.from(props.id);
		this.reportDefinitionId = props.reportDefinitionId;
		this.reportDefinitionVersion = props.reportDefinitionVersion;
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

	public static trigger(props: TriggerReportExecutionProps): ReportExecution {
		return ReportExecution.reconstitute({
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

	public static reconstitute(snapshot: ReportExecutionSnapshotProps): ReportExecution {
		return new ReportExecution(snapshot);
	}

	public start(workerId: string): ReportExecution {
		if (this.status !== "pending") {
			throw new InvalidExecutionTransitionError(this.status, "running");
		}

		return this.with({ status: "running", workerId, startedAt: new Date() });
	}

	public succeed(snapshot: ReportSnapshot): ReportExecutionSucceedResult {
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
		const event = new ReportExecutionSucceededEvent(
			this.id.value,
			this.reportDefinitionId,
			this.reportDefinitionVersion,
			snapshot,
			finishedAt,
		);

		return { execution, event };
	}

	public fail(errorMessage: string): ReportExecutionFailResult {
		if (this.status !== "running") {
			throw new InvalidExecutionTransitionError(this.status, "failed");
		}

		const finishedAt = new Date();
		const execution = this.with({ status: "failed", errorMessage, finishedAt });
		const event = new ReportExecutionFailedEvent(
			this.id.value,
			this.reportDefinitionId,
			errorMessage,
			finishedAt,
		);

		return { execution, event };
	}

	// A queue-driven backoff retry of the same attempt — see report-lifecycle.spec.md Invariant 13.
	// Never adjusts reportDefinitionVersion/scheduledFor/triggerType: those stay frozen from trigger().
	public retry(): ReportExecution {
		if (this.status !== "failed") {
			throw new InvalidExecutionTransitionError(this.status, "pending");
		}

		return this.with({ status: "pending", errorMessage: null, finishedAt: null });
	}

	private toSnapshot(): ReportExecutionSnapshotProps {
		return {
			id: this.id.value,
			reportDefinitionId: this.reportDefinitionId,
			reportDefinitionVersion: this.reportDefinitionVersion,
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

	private with(patch: Partial<ReportExecutionSnapshotProps>): ReportExecution {
		return ReportExecution.reconstitute({ ...this.toSnapshot(), ...patch });
	}
}
