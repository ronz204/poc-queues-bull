import type { DomainEvent } from "@core/common-domain/event";
import type { ReportDefinitionId } from "@core/analitycal-reports/contexts/definition.aggregate";

export class ReportDefinitionCreated implements DomainEvent {
  constructor(readonly definitionId: ReportDefinitionId, readonly occurredAt: Date) {}
};

export class ReportDefinitionUpdated implements DomainEvent {
  constructor(
    readonly definitionId: ReportDefinitionId,
    readonly newVersion: number,
    readonly cronChanged: boolean,
    readonly occurredAt: Date,
  ) {};
};
