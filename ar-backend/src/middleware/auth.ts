import type { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";

import { verifyJwt } from "../utils/jwt.js";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
	const [scheme, token] = req.header("authorization")?.split(" ") ?? [];

	if (scheme !== "Bearer" || !token) {
		throw createHttpError(401, "Unauthorized");
	}

	try {
		req.user = verifyJwt(token);
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
