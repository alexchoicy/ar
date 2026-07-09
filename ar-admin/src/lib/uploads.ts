export async function uploadFile(
	uploadUrl: string,
	file: File,
	errorMessage = "Failed to upload image",
) {
	const response = await fetch(uploadUrl, {
		method: "PUT",
		headers: {
			"Content-Type": file.type || "application/octet-stream",
			"x-ms-blob-type": "BlockBlob",
		},
		body: file,
	});

	if (!response.ok) {
		throw new Error(errorMessage);
	}
}
