export function getInputFile(event: Event) {
	return (event.target as HTMLInputElement).files?.[0] ?? null;
}

export function replacePreviewUrl(currentUrl: string, file: File | null) {
	if (currentUrl) URL.revokeObjectURL(currentUrl);

	return file ? URL.createObjectURL(file) : "";
}
