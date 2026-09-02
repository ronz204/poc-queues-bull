import type { DomainEvent } from "@core/common-domain/event";
import type { ReportDefinitionId } from "@core/analitycal-reports/contexts/definition.aggregate";
import type { ReportExecutionId } from "@core/analitycal-reports/contexts/execution.aggregate";

export class ReportExecutionScheduled implements DomainEvent {
  constructor(
    readonly executionId: ReportExecutionId,
    readonly definitionId: ReportDefinitionId,
    readonly occurredAt: Date,
  ) {};
};

export class ReportExecutionCompleted implements DomainEvent {
  constructor(
    readonly executionId: ReportExecutionId,
    readonly definitionId: ReportDefinitionId,
    readonly definitionVersion: number,
    readonly fencingToken: number | null,
    readonly occurredAt: Date,
  ) {};
};

export class ReportExecutionFailed implements DomainEvent {
  constructor(
    readonly executionId: ReportExecutionId,
    readonly definitionId: ReportDefinitionId,
    readonly definitionVersion: number,
    readonly errorMessage: string,
    readonly occurredAt: Date,
  ) {};
};
