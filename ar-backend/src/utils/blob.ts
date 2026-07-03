import { BlobSASPermissions, BlobServiceClient } from "@azure/storage-blob";

function getContainerName() {
	const containerName = process.env.AZURE_STORAGE_BLOB_CONTAINER_NAME;

	if (!containerName) {
		throw new Error("AZURE_STORAGE_BLOB_CONTAINER_NAME is required");
	}

	return containerName;
}

export async function createUploadUrl(blobName: string) {
	const connectionString = process.env.AZURE_STORAGE_BLOB_CONNECTION_STRING;
	const containerName = getContainerName();

	if (!connectionString) {
		throw new Error("AZURE_STORAGE_BLOB_CONNECTION_STRING is required");
	}

	const blob = BlobServiceClient.fromConnectionString(connectionString)
		.getContainerClient(containerName)
		.getBlockBlobClient(blobName);

	return blob.generateSasUrl({
		startsOn: new Date(Date.now() - 5 * 60 * 1000),
		expiresOn: new Date(Date.now() + 15 * 60 * 1000),
		permissions: BlobSASPermissions.parse("cw"),
	});
}

export function getBlobUrl(blobName: string) {
	const accountName = process.env.AZURE_STORAGE_BLOB_ACCOUNT_NAME;

	if (!accountName) {
		throw new Error("AZURE_STORAGE_BLOB_ACCOUNT_NAME is required");
	}

	return `https://${accountName}.blob.core.windows.net/${getContainerName()}/${blobName
		.split("/")
		.map(encodeURIComponent)
		.join("/")}`;
}
