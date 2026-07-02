import jwt from "jsonwebtoken";

export type JwtPayload = {
	sub: string;
	studentId: string;
};

export function signJwt(payload: JwtPayload) {
	const secret = process.env.JWT_SECRET;

	if (!secret) {
		throw new Error("JWT_SECRET is required");
	}

	return jwt.sign(payload, secret);
}

export function verifyJwt(token: string) {
	const secret = process.env.JWT_SECRET;

	if (!secret) {
		throw new Error("JWT_SECRET is required");
	}

	const payload = jwt.verify(token, secret);

	if (typeof payload === "string") {
		throw new Error("Invalid JWT payload");
	}

	return payload as JwtPayload;
}
