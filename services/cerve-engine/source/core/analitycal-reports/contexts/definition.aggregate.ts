import { AggregateRoot } from "@core/common-domain/aggregate";
import { Identifier } from "@core/common-domain/identifier";
import { uuidv7 } from "uuidv7";

import { ReportDefinitionCreated, ReportDefinitionUpdated } from "@core/analitycal-reports/contexts/definition.events";
import { ArchivedDefinitionCannotBeUpdatedError, DefinitionAlreadyArchivedError } from "@core/analitycal-reports/contexts/definition.errors";

import type { ReportWindow, CronExpression } from "@core/analitycal-reports/contexts/definition.vos";
import type { AggregationType, GroupByDimension, ReportDefinitionStatus } from "@core/analitycal-reports/contexts/definition.enums";

export class ReportDefinitionId extends Identifier {
  private constructor(value: string) {
    super(value);
  };

  public static generate(): ReportDefinitionId {
    return new ReportDefinitionId(uuidv7());
  };

  public static from(value: string): ReportDefinitionId {
    return new ReportDefinitionId(value);
  };
};

interface ReportDefinitionProps {
  name: string;
  aggregationType: AggregationType;
  groupBy: GroupByDimension;
  window: ReportWindow;
  cron: CronExpression;
};

interface ReportDefinitionSnapshot {
  id: ReportDefinitionId;
  name: string;
  aggregationType: AggregationType;
  groupBy: GroupByDimension;
  window: ReportWindow;
  cron: CronExpression;
  version: number;
  status: ReportDefinitionStatus;
  createdAt: Date;
  updatedAt: Date;
};

interface ReportDefinitionChanges {
  aggregationType?: AggregationType;
  groupBy?: GroupByDimension;
  window?: ReportWindow;
  cron?: CronExpression;
};

export class ReportDefinition extends AggregateRoot<ReportDefinitionId> {
  private constructor(
    id: ReportDefinitionId,
    public name: string,
    public aggregationType: AggregationType,
    public groupBy: GroupByDimension,
    public window: ReportWindow,
    public cron: CronExpression,
    public version: number,
    public status: ReportDefinitionStatus,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {
    super(id);
  };

  public static create(props: ReportDefinitionProps): ReportDefinition {
    const id = ReportDefinitionId.generate();
    const now = new Date();
    const definition = new ReportDefinition(
      id,
      props.name,
      props.aggregationType,
      props.groupBy,
      props.window,
      props.cron,
      1,
      "active",
      now,
      now,
    );
    definition.addDomainEvent(new ReportDefinitionCreated(id, now));
    return definition;
  };

  public static reconstitute(snapshot: ReportDefinitionSnapshot): ReportDefinition {
    return new ReportDefinition(
      snapshot.id,
      snapshot.name,
      snapshot.aggregationType,
      snapshot.groupBy,
      snapshot.window,
      snapshot.cron,
      snapshot.version,
      snapshot.status,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  };

  public update(changes: ReportDefinitionChanges): void {
    if (this.status === "archived") throw new ArchivedDefinitionCannotBeUpdatedError(this.id.value);

    const cronChanged = changes.cron !== undefined && !changes.cron.equals(this.cron);

    if (changes.aggregationType !== undefined) this.aggregationType = changes.aggregationType;
    if (changes.groupBy !== undefined) this.groupBy = changes.groupBy;
    if (changes.window !== undefined) this.window = changes.window;
    if (changes.cron !== undefined) this.cron = changes.cron;

    this.version += 1;
    this.updatedAt = new Date();
    this.addDomainEvent(new ReportDefinitionUpdated(this.id, this.version, cronChanged, this.updatedAt));
  };

  public archive(): void {
    if (this.status === "archived") throw new DefinitionAlreadyArchivedError(this.id.value);
    this.status = "archived";
    this.updatedAt = new Date();
  };
};
