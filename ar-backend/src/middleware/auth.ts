import type { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";

import { verifyJwt } from "../utils/jwt.js";

export const adminAuthCookie = "admin_token";

function getCookie(req: Request, name: string) {
	const cookies = req.header("cookie")?.split("; ") ?? [];
	const prefix = `${name}=`;
	const cookie = cookies.find((value) => value.startsWith(prefix));

	return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : undefined;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
	const [scheme, token] = req.header("authorization")?.split(" ") ?? [];
	const authToken = scheme === "Bearer" ? token : getCookie(req, adminAuthCookie);

	if (!authToken) {
		throw createHttpError(401, "Unauthorized");
	}

	try {
		req.user = verifyJwt(authToken);
	} catch {
		throw createHttpError(401, "Unauthorized");
	}

	return next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
	requireAuth(req, res, () => {
		if (req.user?.role !== "admin") {
			throw createHttpError(403, "Forbidden");
		}

		return next();
	});
}

export function requireStudent(req: Request, res: Response, next: NextFunction) {
	requireAuth(req, res, () => {
		if (req.user?.role !== "student") {
			throw createHttpError(403, "Forbidden");
		}

		return next();
	});
}
