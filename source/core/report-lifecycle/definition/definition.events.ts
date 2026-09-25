import type { DomainEvent } from "@core/shared-kernel";

export class DefinitionCreatedEvent implements DomainEvent {
	readonly type = "definition.created" as const;

	constructor(
		readonly definitionId: string,
		readonly version: number,
		readonly cronExpression: string,
		readonly occurredAt: Date,
	) {}

	get aggregateId(): string {
		return this.definitionId;
	}
}

export class DefinitionChangedEvent implements DomainEvent {
	readonly type = "definition.changed" as const;

	constructor(
		readonly definitionId: string,
		readonly version: number,
		readonly cronExpression: string,
		readonly occurredAt: Date,
	) {}

	get aggregateId(): string {
		return this.definitionId;
	}
}

export class DefinitionArchivedEvent implements DomainEvent {
	readonly type = "definition.archived" as const;

	constructor(
		readonly definitionId: string,
		readonly occurredAt: Date,
	) {}

	get aggregateId(): string {
		return this.definitionId;
	}
}
