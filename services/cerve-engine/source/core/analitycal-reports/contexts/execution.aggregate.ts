import { AggregateRoot } from "@core/common-domain/aggregate";
import { Identifier } from "@core/common-domain/identifier";
import { uuidv7 } from "uuidv7";

import { InvalidExecutionTransitionError } from "@core/analitycal-reports/contexts/execution.errors";
import { ReportExecutionScheduled, ReportExecutionCompleted, ReportExecutionFailed } from "@core/analitycal-reports/contexts/execution.events";

import type { ReportSnapshot } from "@core/analitycal-reports/contexts/execution.vos";
import type { ReportDefinitionId } from "@core/analitycal-reports/contexts/definition.aggregate";
import type { ExecutionStatus, ExecutionTriggerType } from "@core/analitycal-reports/contexts/execution.enums";

export class ReportExecutionId extends Identifier {
  private constructor(value: string) {
    super(value);
  };

  public static generate(): ReportExecutionId {
    return new ReportExecutionId(uuidv7());
  };

  public static from(value: string): ReportExecutionId {
    return new ReportExecutionId(value);
  };
};

interface ReportExecutionScheduleProps {
  reportDefinitionId: ReportDefinitionId;
  reportDefinitionVersion: number;
  triggerType: ExecutionTriggerType;
  scheduledFor: Date;
};

interface ReportExecutionSnapshot {
  id: ReportExecutionId;
  reportDefinitionId: ReportDefinitionId;
  reportDefinitionVersion: number;
  triggerType: ExecutionTriggerType;
  scheduledFor: Date;
  status: ExecutionStatus;
  workerId: string | null;
  fencingToken: number | null;
  result: ReportSnapshot | null;
  errorMessage: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
};

export class ReportExecution extends AggregateRoot<ReportExecutionId> {
  private constructor(
    id: ReportExecutionId,
    public readonly reportDefinitionId: ReportDefinitionId,
    public readonly reportDefinitionVersion: number,
    public readonly triggerType: ExecutionTriggerType,
    public readonly scheduledFor: Date,
    public status: ExecutionStatus,
    public workerId: string | null,
    public fencingToken: number | null,
    public result: ReportSnapshot | null,
    public errorMessage: string | null,
    public startedAt: Date | null,
    public finishedAt: Date | null,
    public readonly createdAt: Date,
  ) {
    super(id);
  };

  public static schedule(props: ReportExecutionScheduleProps): ReportExecution {
    const id = ReportExecutionId.generate();
    const now = new Date();
    const execution = new ReportExecution(
      id,
      props.reportDefinitionId,
      props.reportDefinitionVersion,
      props.triggerType,
      props.scheduledFor,
      "pending",
      null,
      null,
      null,
      null,
      null,
      null,
      now,
    );
    execution.addDomainEvent(new ReportExecutionScheduled(id, props.reportDefinitionId, now));
    return execution;
  };

  public static reconstitute(snapshot: ReportExecutionSnapshot): ReportExecution {
    return new ReportExecution(
      snapshot.id,
      snapshot.reportDefinitionId,
      snapshot.reportDefinitionVersion,
      snapshot.triggerType,
      snapshot.scheduledFor,
      snapshot.status,
      snapshot.workerId,
      snapshot.fencingToken,
      snapshot.result,
      snapshot.errorMessage,
      snapshot.startedAt,
      snapshot.finishedAt,
      snapshot.createdAt,
    );
  };

  public start(workerId: string, fencingToken: number): void {
    if (this.status !== "pending") throw new InvalidExecutionTransitionError(this.status, "running");
    this.status = "running";
    this.workerId = workerId;
    this.fencingToken = fencingToken;
    this.startedAt = new Date();
  };

  public complete(result: ReportSnapshot): void {
    if (this.status !== "running") throw new InvalidExecutionTransitionError(this.status, "succeeded");
    this.status = "succeeded";
    this.result = result;
    this.finishedAt = new Date();
    this.addDomainEvent(
      new ReportExecutionCompleted(this.id, this.reportDefinitionId, this.reportDefinitionVersion, this.fencingToken, this.finishedAt),
    );
  };

  public fail(errorMessage: string): void {
    if (this.status !== "running") throw new InvalidExecutionTransitionError(this.status, "failed");
    this.status = "failed";
    this.errorMessage = errorMessage;
    this.finishedAt = new Date();
    this.addDomainEvent(
      new ReportExecutionFailed(this.id, this.reportDefinitionId, this.reportDefinitionVersion, errorMessage, this.finishedAt),
    );
  };
};
