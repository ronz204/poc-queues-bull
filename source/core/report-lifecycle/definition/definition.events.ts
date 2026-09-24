export class DefinitionChangedEvent {
	readonly type = "definition.changed" as const;

	constructor(
		readonly definitionId: string,
		readonly version: number,
		readonly cronExpression: string,
		readonly occurredAt: Date,
	) {}
}
