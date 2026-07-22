import jwt from "jsonwebtoken";

export type JwtPayload = StudentJwtPayload | AdminJwtPayload;

type StudentJwtPayload = {
	sub: string;
	role: "student";
};

type AdminJwtPayload = {
	sub: string;
	role: "admin";
};

export function signJwt(payload: JwtPayload) {
	const secret = process.env.JWT_SECRET;

	if (!secret) {
		throw new Error("JWT_SECRET is required");
	}

	return jwt.sign(payload, secret, { expiresIn: "30d" });
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

	if (payload.role !== "admin" && payload.role !== "student") {
		throw new Error("Invalid JWT role");
	}

	return payload as JwtPayload;
}
