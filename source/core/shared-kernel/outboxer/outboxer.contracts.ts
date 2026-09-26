export interface DomainEvent {
	readonly type: string;
	readonly aggregateId: string;
	readonly occurredAt: Date;
}

export interface IOutboxerRepository {
	append(event: DomainEvent): Promise<void>;
}
