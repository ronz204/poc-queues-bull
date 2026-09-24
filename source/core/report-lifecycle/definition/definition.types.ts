import type { AggregationType, GroupByDimension, ReportDefinitionStatus } from "./definition.enums";

export interface ReportDefinitionConfigProps {
	name: string;
	aggregationType: AggregationType;
	groupBy: GroupByDimension;
	windowStart: Date;
	windowEnd: Date;
	cronExpression: string;
}

export interface CreateReportDefinitionProps extends ReportDefinitionConfigProps {
	id: string;
}

export type EditReportDefinitionProps = ReportDefinitionConfigProps;

export interface ReportDefinitionSnapshotProps extends ReportDefinitionConfigProps {
	id: string;
	version: number;
	status: ReportDefinitionStatus;
	createdAt: Date;
	updatedAt: Date;
}
