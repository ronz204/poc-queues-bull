import type { ReportExecution, ReportExecutionId } from "@core/analitycal-reports/contexts/execution.aggregate";
import type { ReportDefinitionId } from "@core/analitycal-reports/contexts/definition.aggregate";
import type { ExecutionTriggerType } from "@core/analitycal-reports/contexts/execution.enums";

export interface ReportExecutionRepository {
  save(execution: ReportExecution): Promise<void>;
  findById(id: ReportExecutionId): Promise<ReportExecution | null>;
  findByIdempotencyKey(props: {
    reportDefinitionId: ReportDefinitionId;
    reportDefinitionVersion: number;
    triggerType: ExecutionTriggerType;
    scheduledFor: Date;
  }): Promise<ReportExecution | null>;
  listByDefinition(reportDefinitionId: ReportDefinitionId, pagination?: { limit: number; cursor?: string }): Promise<ReportExecution[]>;
};
