import type { Definition } from "./definition.aggregate";
import type { DefinitionStatus } from "./definition.enums";
import type { DefinitionId } from "./definition.vos";

export interface DefinitionListFilter {
	status?: DefinitionStatus;
}

export interface IDefinitionStore {
	create(definition: Definition): Promise<void>;

	update(definition: Definition): Promise<void>;

	findById(id: DefinitionId): Promise<Definition | null>;

	list(filter?: DefinitionListFilter): Promise<Definition[]>;
}
