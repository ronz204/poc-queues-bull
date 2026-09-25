export class DefinitionCreatedEvent {
	readonly type = "definition.created" as const;

	constructor(
		readonly definitionId: string,
		readonly version: number,
		readonly cronExpression: string,
		readonly occurredAt: Date,
	) {}
}

export class DefinitionChangedEvent {
	readonly type = "definition.changed" as const;

	constructor(
		readonly definitionId: string,
		readonly version: number,
		readonly cronExpression: string,
		readonly occurredAt: Date,
	) {}
}

export class DefinitionArchivedEvent {
	readonly type = "definition.archived" as const;

	constructor(
		readonly definitionId: string,
		readonly occurredAt: Date,
	) {}
}
