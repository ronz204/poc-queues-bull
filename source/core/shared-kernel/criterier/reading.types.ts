export interface Page<TCursor> {
	readonly limit: number;
	readonly after?: TCursor;
}

export interface Slice<TItem, TCursor> {
	readonly items: TItem[];
	readonly next: TCursor | null;
}

export interface Range<T> {
	readonly from?: T;
	readonly to?: T;
}
