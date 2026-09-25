import type { AggregationType, DefinitionStatus, GroupByDimension } from "./definition.enums";
import { ArchivedDefinitionError } from "./definition.errors";
import {
	DefinitionArchivedEvent,
	DefinitionChangedEvent,
	DefinitionCreatedEvent,
} from "./definition.events";
import type {
	CreateDefinitionProps,
	DefinitionSnapshotProps,
	EditDefinitionProps,
} from "./definition.types";
import { CronExpression, DefinitionId, ReportWindow } from "./definition.vos";

type DefinitionCreateResult = { definition: Definition; event: DefinitionCreatedEvent };
type DefinitionEditResult = { definition: Definition; event: DefinitionChangedEvent };
type DefinitionArchiveResult = { definition: Definition; event: DefinitionArchivedEvent };

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

	public static create(props: CreateDefinitionProps): DefinitionCreateResult {
		const now = new Date();
		const definition = Definition.reconstitute({
			...props,
			version: 1,
			status: "active",
			createdAt: now,
			updatedAt: now,
		});
		const event = new DefinitionCreatedEvent(
			definition.id.value,
			definition.version,
			definition.cronExpression.value,
			now,
		);

		return { definition, event };
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

	public archive(): DefinitionArchiveResult {
		if (this.status === "archived") {
			throw new ArchivedDefinitionError(this.id.value);
		}

		const updatedAt = new Date();
		const definition = this.with({ status: "archived", updatedAt });
		const event = new DefinitionArchivedEvent(this.id.value, updatedAt);

		return { definition, event };
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
