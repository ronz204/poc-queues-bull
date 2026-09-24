import type { AggregationType, DefinitionStatus, GroupByDimension } from "./definition.enums";

export interface DefinitionConfigProps {
	name: string;
	aggregationType: AggregationType;
	groupBy: GroupByDimension;
	windowStart: Date;
	windowEnd: Date;
	cronExpression: string;
}

export interface CreateDefinitionProps extends DefinitionConfigProps {
	id: string;
}

export type EditDefinitionProps = DefinitionConfigProps;

export interface DefinitionSnapshotProps extends DefinitionConfigProps {
	id: string;
	version: number;
	status: DefinitionStatus;
	createdAt: Date;
	updatedAt: Date;
}
