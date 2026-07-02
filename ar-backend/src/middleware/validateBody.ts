import type { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import type { z } from "zod";

export function validateBody<T extends z.ZodType>(schema: T) {
	return (req: Request, res: Response, next: NextFunction) => {
		const result = schema.safeParse(req.body);

		if (!result.success) {
			throw createHttpError(400, "Validation failed", {
				details: result.error.issues,
			});
		}

		req.body = result.data;
		return next();
	};
}
