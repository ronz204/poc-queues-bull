import type { IDefinitionStore, IExecutionStore } from "@core/report-lifecycle";
import type { IOutboxStore } from "@core/shared-kernel";
import { TxToken } from "@drizz/drizzle.wrap";
/* import { DefinitionStore } from "@infra/stores/definition.store";
import { ExecutionStore } from "@infra/stores/execution.store";
import { OutboxStore } from "@infra/stores/outbox.store"; */
import { type Module, token } from "dockdi";

// ==========================================
// ====== Stores
// ==========================================

/* export const DefinitionStoreToken = token<IDefinitionStore>("DefinitionStore");
export const ExecutionStoreToken = token<IExecutionStore>("ExecutionStore");
export const OutboxStoreToken = token<IOutboxStore>("OutboxStore");

export const storesDock: Module = (container) => {
	container.bind(DefinitionStoreToken).toClass(DefinitionStore, [TxToken]);
	container.bind(ExecutionStoreToken).toClass(ExecutionStore, [TxToken]);
	container.bind(OutboxStoreToken).toClass(OutboxStore, [TxToken]);
};
 */
