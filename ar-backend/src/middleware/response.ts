import type { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";

export function responseMiddleware(
	_req: Request,
	res: Response,
	next: NextFunction,
) {
	res.api = (status, data) =>
		res.status(status).json({ success: status < 400, data });
	return next();
}

function isDuplicateKeyError(error: unknown) {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === 11000
	);
}

export function errorMiddleware(
	error: unknown,
	_req: Request,
	res: Response,
	_next: NextFunction,
) {
	const httpError = isDuplicateKeyError(error)
		? createHttpError(409, "Duplicate key")
		: createHttpError.isHttpError(error)
			? error
			: createHttpError(500, "Internal Server Error");

	return res.status(httpError.statusCode).json({
		success: false,
		error: httpError.message,
		...("details" in httpError ? { details: httpError.details } : {}),
	});
}
