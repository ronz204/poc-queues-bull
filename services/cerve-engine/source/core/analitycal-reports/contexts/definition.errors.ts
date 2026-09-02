import { DomainError } from "@core/common-domain/error";

export class InvalidCronExpressionError extends DomainError {
  constructor(raw: string) {
    super(`"${raw}" is not a valid cron expression`);
  };
};

export class InvalidReportWindowError extends DomainError {
  constructor(start: Date, end: Date) {
    super(`report window start (${start.toISOString()}) must be before end (${end.toISOString()})`);
  };
};

export class ArchivedDefinitionCannotBeUpdatedError extends DomainError {
  constructor(definitionId: string) {
    super(`report definition ${definitionId} is archived and cannot be updated`);
  };
};

export class DefinitionAlreadyArchivedError extends DomainError {
  constructor(definitionId: string) {
    super(`report definition ${definitionId} is already archived`);
  };
};
