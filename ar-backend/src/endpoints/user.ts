import { Router } from "express";
import createHttpError from "http-errors";
import { Types } from "mongoose";
import { z } from "zod";

import { FACULTIES, INTERESTS } from "../constants/student.js";
import type { Faculty, Interest } from "../constants/student.js";
import { Booth } from "../db/schema/booth.js";
import { Event } from "../db/schema/event.js";
import { Student } from "../db/schema/student.js";
import { requireAuth, requireStudent } from "../middleware/auth.js";
import { validateBody } from "../middleware/validateBody.js";
import { signJwt } from "../utils/jwt.js";

export const userRouter = Router();

const registerInput = z.object({
	studentId: z.string().regex(/^\d{8}$/, "studentId must be 8 digits"),
	email: z.email(),
	name: z.string().min(1),
	faculty: z.enum(FACULTIES),
	major: z.string().min(1),
	yearOfStudy: z.number().int().default(1),
	interests: z.array(z.enum(INTERESTS)).default([]),
});

const savedInput = z.object({
	id: z.string().refine(Types.ObjectId.isValid, "id must be a valid ObjectId"),
});

const stampInput = z.object({
	id: z.string().min(1),
});

const redeemInput = z.object({
	type: z.enum(["minor", "major"]),
	redeemKey: z.string().min(1),
});

type RegisterOutput = {
	token: string;
	user: UserOutput;
};

type UserOutput = {
	id: string;
	studentId: string;
	email: string;
	name: string;
	faculty: Faculty;
	major: string;
	yearOfStudy: number;
	interests: Interest[];
	eStamps: { boothId: string; dateTime: Date }[];
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
	email: string;
	name: string;
	faculty: Faculty;
	major: string;
	yearOfStudy: number;
	interests: Interest[];
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
		email: student.email,
		name: student.name,
		faculty: student.faculty,
		major: student.major,
		yearOfStudy: student.yearOfStudy,
		interests: student.interests,
		eStamps: student.eStamps.map((stamp) => ({
			boothId: stamp.id.toString(),
			dateTime: stamp.dateTime,
		})),
		savedEvents: student.savedEvents.map((event) => event.toString()),
		savedBooths: student.savedBooths.map((booth) => booth.toString()),
		isCompletedSurvey: student.isCompletedSurvey,
		redeemed: {
			minorGift: {
				redeemedDateTime:
					student.redeemed?.minorGift?.redeemedDateTime ?? undefined,
			},
			majorGift: {
				redeemedDateTime:
					student.redeemed?.majorGift?.redeemedDateTime ?? undefined,
			},
		},
	};
}

async function getCurrentStudent(userId: string | undefined) {
	const student = await Student.findById(userId);

	if (!student) {
		throw createHttpError(404, "User not found");
	}

	return student;
}

function toggleSaved(savedItems: any[], id: string) {
	const wasSaved = savedItems.some((savedItem) => savedItem.equals(id));

	return {
		isSaved: !wasSaved,
		items: wasSaved
			? savedItems.filter((savedItem) => !savedItem.equals(id))
			: [...savedItems, id],
	};
}

userRouter.get("/me", requireAuth, async (req, res) => {
	const student = await getCurrentStudent(req.user?.sub);

	return res.api(200, toUserOutput(student));
});

userRouter.post(
	"/saved/events",
	requireStudent,
	validateBody(savedInput),
	async (req, res) => {
		const event = await Event.exists({ _id: req.body.id });

		if (!event) {
			throw createHttpError(404, "Event not found");
		}

		const student = await getCurrentStudent(req.user?.sub);
		const saved = toggleSaved(student.savedEvents, req.body.id);
		student.savedEvents = saved.items;
		await student.save();

		return res.api(200, {
			isSaved: saved.isSaved,
			savedEvents: student.savedEvents.map((savedEvent) =>
				savedEvent.toString(),
			),
		});
	},
);

userRouter.post(
	"/saved/booths",
	requireStudent,
	validateBody(savedInput),
	async (req, res) => {
		const booth = await Booth.exists({ _id: req.body.id });

		if (!booth) {
			throw createHttpError(404, "Booth not found");
		}

		const student = await getCurrentStudent(req.user?.sub);
		const saved = toggleSaved(student.savedBooths, req.body.id);
		student.savedBooths = saved.items;
		await student.save();

		return res.api(200, {
			isSaved: saved.isSaved,
			savedBooths: student.savedBooths.map((savedBooth) =>
				savedBooth.toString(),
			),
		});
	},
);

userRouter.post(
	"/stamps",
	requireStudent,
	validateBody(stampInput),
	async (req, res) => {
		const booth = await Booth.findOne({ qrCode: req.body.id });

		if (!booth) {
			throw createHttpError(404, "Booth not found");
		}

		const dateTime = new Date();
		const stampedStudent = await Student.findOneAndUpdate(
			{ _id: req.user?.sub, "eStamps.id": { $ne: booth._id } },
			{ $push: { eStamps: { id: booth._id, dateTime } } },
			{ new: true },
		);

		if (stampedStudent) {
			return res.api(201, {
				stamp: {
					boothId: booth.id,
					dateTime,
				},
				stamps: stampedStudent.eStamps.length,
			});
		}

		const student = await Student.findById(req.user?.sub);

		if (!student) {
			throw createHttpError(404, "User not found");
		}

		const existingStamp = student.eStamps.find((stamp) =>
			stamp.id.equals(booth._id),
		);

		if (existingStamp) {
			return res.api(200, {
				stamp: { boothId: booth.id, dateTime: existingStamp.dateTime },
				stamps: student.eStamps.length,
			});
		}

		throw createHttpError(400, "Unable to add stamp");
	},
);

userRouter.post(
	"/redeem",
	requireStudent,
	validateBody(redeemInput),
	async (req, res) => {
		if (process.env.TEMP_REDEEM_KEY !== req.body.redeemKey) {
			throw createHttpError(400, "Invalid redeem key");
		}

		const key = req.body.type === "minor" ? "minorGift" : "majorGift";
		const requiredStamps = req.body.type === "minor" ? 5 : 10;
		const redeemedPath = `redeemed.${key}.redeemedDateTime`;
		const redeemedStudent = await Student.findOneAndUpdate(
			{
				_id: req.user?.sub,
				isCompletedSurvey: true,
				[redeemedPath]: null,
				$expr: {
					$gte: [{ $size: { $ifNull: ["$eStamps", []] } }, requiredStamps],
				},
			},
			{ $set: { [redeemedPath]: new Date() } },
			{ new: true },
		);

		if (redeemedStudent) {
			return res.api(200, toUserOutput(redeemedStudent));
		}

		const student = await Student.findById(req.user?.sub);

		if (!student) {
			throw createHttpError(404, "User not found");
		}

		if (!student.isCompletedSurvey) {
			throw createHttpError(400, "Survey must be completed before redemption");
		}

		if (student.eStamps.length < requiredStamps) {
			throw createHttpError(400, `${requiredStamps} stamps required`);
		}

		if (student.redeemed?.[key]?.redeemedDateTime) {
			throw createHttpError(400, "Gift already redeemed");
		}

		throw createHttpError(400, "Unable to redeem gift");
	},
);

userRouter.post("/register", validateBody(registerInput), async (req, res) => {
	const student = await Student.create(req.body);
	const token = signJwt({
		sub: student.id,
		role: "student",
		studentId: student.studentId,
	});
	const output: RegisterOutput = {
		token,
		user: toUserOutput(student),
	};

	return res.api(201, output);
});
