import { randomUUID } from "node:crypto";

import pino from "pino";
import { pinoHttp } from "pino-http";

const isProd = process.env.NODE_ENV === "production";

export const logger = pino({
	level: process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"),

	transport: isProd
		? undefined
		: {
				target: "pino-pretty",
				options: {
					colorize: true,
					translateTime: "SYS:standard",
					singleLine: true,
				},
			},

	redact: {
		paths: [
			"req.headers.authorization",
			"req.headers.cookie",
			"password",
			"*.password",
			"body.password",
			"token",
			"*.token",
		],
		censor: "[redacted]",
	},
});

export const httpLogger = pinoHttp({
	logger,

	genReqId(req, res) {
		const existing = req.headers["x-request-id"];
		const requestId = Array.isArray(existing)
			? existing[0]
			: (existing ?? randomUUID());

		res.setHeader("x-request-id", requestId);
		return requestId;
	},

	customLogLevel(req, res, err) {
		if (err || res.statusCode >= 500) return "error";
		if (res.statusCode >= 400) return "warn";
		return "info";
	},
});
