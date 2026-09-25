export interface DomainEvent {
	readonly type: string;
	readonly aggregateId: string;
	readonly occurredAt: Date;
}

export interface IOutboxStore {
	append(event: DomainEvent): Promise<void>;
}
