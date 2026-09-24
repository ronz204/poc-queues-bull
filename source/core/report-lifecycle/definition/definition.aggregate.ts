import type { AggregationType, DefinitionStatus, GroupByDimension } from "./definition.enums";
import { ArchivedDefinitionError } from "./definition.errors";
import { DefinitionChangedEvent } from "./definition.events";
import type {
	CreateDefinitionProps,
	DefinitionSnapshotProps,
	EditDefinitionProps,
} from "./definition.types";
import { CronExpression, DefinitionId, ReportWindow } from "./definition.vos";

type DefinitionEditResult = {
	definition: Definition;
	event: DefinitionChangedEvent;
};

export class Definition {
	readonly id: DefinitionId;
	readonly name: string;
	readonly aggregationType: AggregationType;
	readonly groupBy: GroupByDimension;
	readonly window: ReportWindow;
	readonly cronExpression: CronExpression;
	readonly version: number;
	readonly status: DefinitionStatus;
	readonly createdAt: Date;
	readonly updatedAt: Date;

	private constructor(props: DefinitionSnapshotProps) {
		this.id = DefinitionId.from(props.id);
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

	public static create(props: CreateDefinitionProps): Definition {
		const now = new Date();
		return Definition.reconstitute({
			...props,
			version: 1,
			status: "active",
			createdAt: now,
			updatedAt: now,
		});
	}

	public static reconstitute(snapshot: DefinitionSnapshotProps): Definition {
		return new Definition(snapshot);
	}

	public edit(props: EditDefinitionProps): DefinitionEditResult {
		if (this.status === "archived") {
			throw new ArchivedDefinitionError(this.id.value);
		}

		const updatedAt = new Date();
		const definition = this.with({
			...props,
			version: this.version + 1,
			updatedAt,
		});
		const event = new DefinitionChangedEvent(
			this.id.value,
			definition.version,
			definition.cronExpression.value,
			updatedAt,
		);

		return { definition, event };
	}

	public archive(): Definition {
		if (this.status === "archived") {
			throw new ArchivedDefinitionError(this.id.value);
		}

		return this.with({ status: "archived", updatedAt: new Date() });
	}

	public toSnapshot(): DefinitionSnapshotProps {
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

	private with(patch: Partial<DefinitionSnapshotProps>): Definition {
		return Definition.reconstitute({ ...this.toSnapshot(), ...patch });
	}
}
