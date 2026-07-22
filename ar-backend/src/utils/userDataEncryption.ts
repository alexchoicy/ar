import {
	createCipheriv,
	createDecipheriv,
	createHmac,
	randomBytes,
} from "node:crypto";

const version = "v1";
type UserDataField = "studentId" | "email";

function key(purpose: "encryption" | "lookup-index") {
	const masterKey = Buffer.from(
		process.env.USER_DATA_ENCRYPTION_KEY!,
		"base64",
	);
	return createHmac("sha256", masterKey).update(purpose).digest();
}

export function normalizeEmail(email: string) {
	return email.trim().toLowerCase();
}

export function userDataIndex(value: string, field: "studentId" | "email") {
	return createHmac("sha256", key("lookup-index"))
		.update(field)
		.update("\0")
		.update(field === "email" ? normalizeEmail(value) : value)
		.digest("base64url");
}

export function encryptUserData(value: string, field: UserDataField) {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key("encryption"), iv);
	cipher.setAAD(Buffer.from(field));
	const encrypted = Buffer.concat([
		cipher.update(value, "utf8"),
		cipher.final(),
	]);

	return [
		version,
		iv.toString("base64url"),
		cipher.getAuthTag().toString("base64url"),
		encrypted.toString("base64url"),
	].join(":");
}

export function decryptUserData(value: string, field: UserDataField) {
	const parts = value.split(":");
	if (parts.length !== 4 || parts[0] !== version) {
		throw new Error("Invalid encrypted user data");
	}

	const [, encodedIv, encodedTag, encodedValue] = parts;
	const decipher = createDecipheriv(
		"aes-256-gcm",
		key("encryption"),
		Buffer.from(encodedIv, "base64url"),
	);
	decipher.setAAD(Buffer.from(field));
	decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));

	return Buffer.concat([
		decipher.update(Buffer.from(encodedValue, "base64url")),
		decipher.final(),
	]).toString("utf8");
}
