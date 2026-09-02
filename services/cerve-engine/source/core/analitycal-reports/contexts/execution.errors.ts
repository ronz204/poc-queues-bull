import { DomainError } from "@core/common-domain/error";
import type { ExecutionStatus } from "@core/analitycal-reports/contexts/execution.enums";

export class InvalidExecutionTransitionError extends DomainError {
  constructor(from: ExecutionStatus, to: ExecutionStatus) {
    super(`cannot transition report execution from "${from}" to "${to}"`);
  };
};
