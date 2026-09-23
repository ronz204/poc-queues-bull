export interface GenerateSaleTransactionProps {
	id: string;
	productId: string;
	regionId: string;
	amount: number;
	occurredAt: Date;
}

export interface SaleTransactionSnapshotProps {
	id: string;
	productId: string;
	regionId: string;
	amount: number;
	occurredAt: Date;
	createdAt: Date;
}
