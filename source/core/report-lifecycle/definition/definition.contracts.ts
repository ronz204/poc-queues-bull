import type { Page, Slice } from "@core/shared-kernel";
import type { Definition } from "./definition.aggregate";
import type { DefinitionStatus } from "./definition.enums";
import type { DefinitionId } from "./definition.vos";

export interface DefinitionFilter {
	readonly status?: DefinitionStatus;
}

export interface DefinitionCursor {
	readonly createdAt: Date;
	readonly id: DefinitionId;
}

export interface IDefinitionRepository {
	create(definition: Definition): Promise<void>;

	update(definition: Definition): Promise<void>;

	findById(id: DefinitionId): Promise<Definition | null>;

	lockById(id: DefinitionId): Promise<Definition | null>;

	list(
		filter: DefinitionFilter,
		page: Page<DefinitionCursor>,
	): Promise<Slice<Definition, DefinitionCursor>>;
}
