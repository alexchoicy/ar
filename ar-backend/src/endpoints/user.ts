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
	eStamps: { id: string; dateTime: Date }[];
	savedEvents: string[];
	savedBooths: string[];
	isCompletedSurvey: boolean;
	redeemed: {
		minorGift?: { redeemedDateTime?: Date };
		majorGift?: { redeemedDateTime?: Date };
	};
};

function toUserOutput(student: {
	id: string;
	studentId: string;
	name: string;
	faculty: string;
	major: string;
	yearOfStudy: number;
	interests: string[];
	eStamps: { id: { toString(): string }; dateTime: Date }[];
	savedEvents: { toString(): string }[];
	savedBooths: { toString(): string }[];
	isCompletedSurvey: boolean;
	redeemed?: {
		minorGift?: { redeemedDateTime?: Date | null } | null;
		majorGift?: { redeemedDateTime?: Date | null } | null;
	} | null;
}): UserOutput {
	return {
		id: student.id,
		studentId: student.studentId,
		name: student.name,
		faculty: student.faculty,
		major: student.major,
		yearOfStudy: student.yearOfStudy,
		interests: student.interests,
		eStamps: student.eStamps.map((stamp) => ({ id: stamp.id.toString(), dateTime: stamp.dateTime })),
		savedEvents: student.savedEvents.map((event) => event.toString()),
		savedBooths: student.savedBooths.map((booth) => booth.toString()),
		isCompletedSurvey: student.isCompletedSurvey,
		redeemed: {
			minorGift: { redeemedDateTime: student.redeemed?.minorGift?.redeemedDateTime ?? undefined },
			majorGift: { redeemedDateTime: student.redeemed?.majorGift?.redeemedDateTime ?? undefined },
		},
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
