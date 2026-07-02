import { Router } from "express";
import createHttpError from "http-errors";
import { z } from "zod";

import { Student } from "../db/schema/student.js";
import { validateBody } from "../middleware/validateBody.js";
import { signJwt } from "../utils/jwt.js";

export const authRouter = Router();

const loginInput = z.object({
	studentId: z.string().regex(/^\d{8}$/, "studentId must be 8 digits"),
	name: z.string().min(1),
});

authRouter.post("/login", validateBody(loginInput), async (req, res) => {
	const student = await Student.findOne(req.body);

	if (!student) {
		throw createHttpError(401, "Invalid credentials");
	}

	return res.api(200, {
		token: signJwt({ sub: student.id, studentId: student.studentId }),
		user: {
			id: student.id,
			studentId: student.studentId,
			name: student.name,
			faculty: student.faculty,
			major: student.major,
			yearOfStudy: student.yearOfStudy,
			interests: student.interests,
		},
	});
});
