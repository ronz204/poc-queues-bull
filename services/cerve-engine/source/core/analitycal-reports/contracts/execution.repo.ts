import type { ReportExecution, ReportExecutionId } from "@core/analitycal-reports/contexts/execution.aggregate";
import type { ReportDefinitionId } from "@core/analitycal-reports/contexts/definition.aggregate";
import type { ExecutionTriggerType } from "@core/analitycal-reports/contexts/execution.enums";
import type { Pagination } from "@core/common-domain/pagination";

export interface ReportExecutionIdempotencyKey {
  reportDefinitionId: ReportDefinitionId;
  reportDefinitionVersion: number;
  triggerType: ExecutionTriggerType;
  scheduledFor: Date;
};

export interface IReportExecutionRepo {
  save(execution: ReportExecution): Promise<void>;
  findById(id: ReportExecutionId): Promise<ReportExecution | null>;
  findByIdempotencyKey(key: ReportExecutionIdempotencyKey): Promise<ReportExecution | null>;
  listByDefinition(reportDefinitionId: ReportDefinitionId, pagination?: Pagination): Promise<ReportExecution[]>;
};
