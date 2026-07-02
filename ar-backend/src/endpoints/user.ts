import { Router } from "express";
import createHttpError from "http-errors";
import { z } from "zod";

import { Student } from "../db/schema/student.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validateBody.js";
import { signJwt } from "../utils/jwt.js";

export const userRouter = Router();

const registerInput = z.object({
	studentId: z.string().regex(/^\d{8}$/, "studentId must be 8 digits"),
	name: z.string().min(1),
	faculty: z.string().min(1),
	major: z.string().min(1),
	yearOfStudy: z.number().int().default(1),
	interests: z.array(z.string()).default([]),
});

type RegisterOutput = {
	token: string;
	user: UserOutput;
};

type UserOutput = {
	id: string;
	studentId: string;
	name: string;
	faculty: string;
	major: string;
	yearOfStudy: number;
	interests: string[];
};

function toUserOutput(student: {
	id: string;
	studentId: string;
	name: string;
	faculty: string;
	major: string;
	yearOfStudy: number;
	interests: string[];
}): UserOutput {
	return {
		id: student.id,
		studentId: student.studentId,
		name: student.name,
		faculty: student.faculty,
		major: student.major,
		yearOfStudy: student.yearOfStudy,
		interests: student.interests,
	};
}

userRouter.get("/me", requireAuth, async (req, res) => {
	const student = await Student.findById(req.user?.sub);

	if (!student) {
		throw createHttpError(404, "User not found");
	}

	return res.api(200, toUserOutput(student));
});

userRouter.post(
	"/register",
	validateBody(registerInput),
	async (req, res) => {
		const student = await Student.create(req.body);
		const token = signJwt({ sub: student.id, studentId: student.studentId });
		const output: RegisterOutput = {
			token,
			user: toUserOutput(student),
		};

		return res.api(201, output);
	},
);
