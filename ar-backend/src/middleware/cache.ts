import type { NextFunction, Request, Response } from "express";

type CachedResponse = {
	status: number;
	data: unknown;
	expiresAt: number;
};

const cache = new Map<string, CachedResponse>();
const maxItems = 200;

export function clearCache() {
	cache.clear();
}

export function cacheGet(ttlMs = 60_000) {
	return (req: Request, res: Response, next: NextFunction) => {
		if (req.method !== "GET") {
			return next();
		}

		const key = req.originalUrl;
		const cached = cache.get(key);

		if (cached && cached.expiresAt > Date.now()) {
			return res.status(cached.status).json({ success: cached.status < 400, data: cached.data });
		}

		cache.delete(key);
		const api = res.api.bind(res);
		res.api = (status, data) => {
			if (status >= 200 && status < 300) {
				if (cache.size >= maxItems) {
					const firstKey = cache.keys().next().value;

					if (firstKey) {
						cache.delete(firstKey);
					}
				}

				cache.set(key, { status, data, expiresAt: Date.now() + ttlMs });
			}

			return api(status, data);
		};

		return next();
	};
}
