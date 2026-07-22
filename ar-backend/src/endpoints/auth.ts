import { Router } from "express";
import createHttpError from "http-errors";
import { z } from "zod";

import { EMPTY_STUDENT_ID } from "../constants/student.js";
import { Student } from "../db/schema/student.js";
import { adminAuthCookie, requireAdmin } from "../middleware/auth.js";
import { validateBody } from "../middleware/validateBody.js";
import { signJwt } from "../utils/jwt.js";
import { normalizeEmail, userDataIndex } from "../utils/userDataEncryption.js";

export const authRouter = Router();
export const adminAuthRouter = Router();

const loginInput = z.object({
	studentId: z.string().regex(/^\d{8}$/, "studentId must be 8 digits"),
	email: z.email(),
});

const adminLoginInput = z.object({
	name: z.string().min(1),
	password: z.string().min(1),
});

function assertAdminCredentials(name: string, password: string) {
	if (
		name !== process.env.ADMIN_NAME ||
		password !== process.env.ADMIN_PASSWORD
	) {
		throw createHttpError(401, "Invalid credentials");
	}
}

function toAdminUser(name: string) {
	return {
		id: name,
		role: "admin",
		name,
	};
}

authRouter.post("/login", validateBody(loginInput), async (req, res) => {
	const email = normalizeEmail(req.body.email);
	const student = await Student.findOne({
		...(req.body.studentId === EMPTY_STUDENT_ID
			? { studentId: null }
			: { studentIdIndex: userDataIndex(req.body.studentId, "studentId") }),
		emailIndex: userDataIndex(email, "email"),
	});

	if (!student) {
		throw createHttpError(401, "Invalid credentials");
	}

	return res.api(200, {
		token: signJwt({
			sub: student.id,
			role: "student",
		}),
		user: {
			id: student.id,
			role: "student",
			name: student.name,
			faculty: student.faculty,
			major: student.major,
			yearOfStudy: student.yearOfStudy,
			interests: student.interests,
		},
	});
});

adminAuthRouter.post(
	"/login",
	validateBody(adminLoginInput),
	async (req, res) => {
		assertAdminCredentials(req.body.name, req.body.password);

		res.cookie(
			adminAuthCookie,
			signJwt({ sub: req.body.name, role: "admin" }),
			{
				httpOnly: true,
				sameSite: "lax",
				secure: process.env.NODE_ENV === "production",
			},
		);

		return res.api(200, {
			user: toAdminUser(req.body.name),
		});
	},
);

adminAuthRouter.get("/me", requireAdmin, (req, res) =>
	res.api(200, {
		user: toAdminUser(req.user!.sub),
	}),
);
