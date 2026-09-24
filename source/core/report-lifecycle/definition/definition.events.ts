export class ReportDefinitionChangedEvent {
	readonly type = "report-definition.changed" as const;

	constructor(
		readonly reportDefinitionId: string,
		readonly version: number,
		readonly cronExpression: string,
		readonly occurredAt: Date,
	) {}
}
