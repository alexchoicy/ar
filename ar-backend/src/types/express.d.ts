import type { JwtPayload } from "../utils/jwt.js";

declare global {
	namespace Express {
		interface Request {
			user?: JwtPayload;
		}

		interface Response {
			api(status: number, data: unknown): this;
		}
	}
}
