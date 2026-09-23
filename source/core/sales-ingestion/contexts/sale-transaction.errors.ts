export class InvalidSaleAmountError extends Error {
	constructor(readonly amount: number) {
		super(`sale transaction amount must be positive, received ${amount}`);
		this.name = "InvalidSaleAmountError";
	}
}
