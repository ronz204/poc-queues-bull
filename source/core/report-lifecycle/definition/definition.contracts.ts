import type { ReportDefinition } from "./definition.aggregate";
import type { ReportDefinitionStatus } from "./definition.enums";
import type { ReportDefinitionId } from "./definition.vos";

export interface ReportDefinitionListFilter {
	status?: ReportDefinitionStatus;
}

export interface IReportDefinitionStore {
	create(definition: ReportDefinition): Promise<void>;

	update(definition: ReportDefinition): Promise<void>;

	findById(id: ReportDefinitionId): Promise<ReportDefinition | null>;

	list(filter?: ReportDefinitionListFilter): Promise<ReportDefinition[]>;
}
