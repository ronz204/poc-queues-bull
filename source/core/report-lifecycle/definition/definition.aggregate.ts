import type { AggregationType, GroupByDimension, ReportDefinitionStatus } from "./definition.enums";
import { ArchivedReportDefinitionError } from "./definition.errors";
import { ReportDefinitionChangedEvent } from "./definition.events";
import type {
	CreateReportDefinitionProps,
	EditReportDefinitionProps,
	ReportDefinitionSnapshotProps,
} from "./definition.types";
import { CronExpression, ReportDefinitionId, ReportWindow } from "./definition.vos";

type ReportDefinitionEditResult = {
	definition: ReportDefinition;
	event: ReportDefinitionChangedEvent;
};

export class ReportDefinition {
	readonly id: ReportDefinitionId;
	readonly name: string;
	readonly aggregationType: AggregationType;
	readonly groupBy: GroupByDimension;
	readonly window: ReportWindow;
	readonly cronExpression: CronExpression;
	readonly version: number;
	readonly status: ReportDefinitionStatus;
	readonly createdAt: Date;
	readonly updatedAt: Date;

	private constructor(props: ReportDefinitionSnapshotProps) {
		this.id = ReportDefinitionId.from(props.id);
		this.name = props.name;
		this.aggregationType = props.aggregationType;
		this.groupBy = props.groupBy;
		this.window = ReportWindow.from(props.windowStart, props.windowEnd);
		this.cronExpression = CronExpression.from(props.cronExpression);
		this.version = props.version;
		this.status = props.status;
		this.createdAt = props.createdAt;
		this.updatedAt = props.updatedAt;
	}

	public static create(props: CreateReportDefinitionProps): ReportDefinition {
		const now = new Date();
		return ReportDefinition.reconstitute({
			...props,
			version: 1,
			status: "active",
			createdAt: now,
			updatedAt: now,
		});
	}

	public static reconstitute(snapshot: ReportDefinitionSnapshotProps): ReportDefinition {
		return new ReportDefinition(snapshot);
	}

	public edit(props: EditReportDefinitionProps): ReportDefinitionEditResult {
		if (this.status === "archived") {
			throw new ArchivedReportDefinitionError(this.id.value);
		}

		const updatedAt = new Date();
		const definition = this.with({
			...props,
			version: this.version + 1,
			updatedAt,
		});
		const event = new ReportDefinitionChangedEvent(
			this.id.value,
			definition.version,
			definition.cronExpression.value,
			updatedAt,
		);

		return { definition, event };
	}

	public archive(): ReportDefinition {
		if (this.status === "archived") {
			throw new ArchivedReportDefinitionError(this.id.value);
		}

		return this.with({ status: "archived", updatedAt: new Date() });
	}

	private toSnapshot(): ReportDefinitionSnapshotProps {
		return {
			id: this.id.value,
			name: this.name,
			aggregationType: this.aggregationType,
			groupBy: this.groupBy,
			windowStart: this.window.start,
			windowEnd: this.window.end,
			cronExpression: this.cronExpression.value,
			version: this.version,
			status: this.status,
			createdAt: this.createdAt,
			updatedAt: this.updatedAt,
		};
	}

	private with(patch: Partial<ReportDefinitionSnapshotProps>): ReportDefinition {
		return ReportDefinition.reconstitute({ ...this.toSnapshot(), ...patch });
	}
}
