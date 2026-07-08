export async function login(name: string, password: string) {
	const response = await fetch("/api/admin/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({ name, password }),
	});

	return response.ok;
}

export async function isAdminLoggedIn() {
	const response = await fetch("/api/admin/me", {
		credentials: "include",
	});

	return response.ok;
}
