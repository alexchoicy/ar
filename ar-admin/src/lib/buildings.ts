export type Building = {
	id: string;
	name: string;
	shortCode: string;
};

export async function fetchBuildings() {
	const response = await fetch("/api/buildings");
	const body = await response.json();

	if (!response.ok) {
		throw new Error(body.error ?? "Failed to load buildings");
	}

	return body.data as Building[];
}
