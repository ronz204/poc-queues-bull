import { toPersistenceError } from "./dal.classifier";
import { PersistenceError } from "./dal.exceptions";

export const translatingViolations = async <T>(
	operation: PromiseLike<T>,
	violations: Readonly<Record<string, () => Error>>,
): Promise<T> => {
	try {
		return await operation;
	} catch (error) {
		const failure = toPersistenceError(error);
		const translate =
			failure instanceof PersistenceError && failure.constraint
				? violations[failure.constraint]
				: undefined;
		throw translate ? translate() : failure;
	}
};
