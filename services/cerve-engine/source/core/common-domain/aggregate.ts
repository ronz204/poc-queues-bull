import type { DomainEvent } from "@core/common-domain/event";
import type { Identifier } from "@core/common-domain/identifier";

export abstract class AggregateRoot<TId extends Identifier> {
  private domainEvents: DomainEvent[] = [];

  protected constructor(readonly id: TId) {};

  protected addDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  };

  public pullDomainEvents(): DomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  };
};
