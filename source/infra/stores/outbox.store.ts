import type { DomainEvent, IOutboxStore } from "@core/shared-kernel";
import type { Executor } from "@drizz/helpers/executor.helper";
import { outbox } from "@drizz/models/outbox.model";

export class OutboxStore implements IOutboxStore {
	constructor(private readonly db: Executor) {}

	async append(event: DomainEvent): Promise<void> {
		await this.db.insert(outbox).values({
			eventType: event.type,
			aggregateId: event.aggregateId,
			payload: event,
			occurredAt: event.occurredAt,
		});
	}
}
