import type { ReportDefinition, ReportDefinitionId } from "@core/analitycal-reports/contexts/definition.aggregate";
import type { ReportDefinitionStatus } from "@core/analitycal-reports/contexts/definition.enums";

export interface ReportDefinitionListFilter {
  status?: ReportDefinitionStatus;
};

export interface IReportDefinitionRepo {
  save(definition: ReportDefinition): Promise<void>;
  findById(id: ReportDefinitionId): Promise<ReportDefinition | null>;
  findActiveByName(name: string): Promise<ReportDefinition | null>;
  list(filter?: ReportDefinitionListFilter): Promise<ReportDefinition[]>;
};
