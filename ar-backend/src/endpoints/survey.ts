import { Router } from "express";
import createHttpError from "http-errors";
import { Types } from "mongoose";
import { z } from "zod";

import { Student } from "../db/schema/student.js";
import { SurveyQuestion } from "../db/schema/surveyQuestion.js";
import { SurveyResponse } from "../db/schema/surveyResponse.js";
import { requireStudent } from "../middleware/auth.js";
import { cacheGet } from "../middleware/cache.js";
import { validateBody } from "../middleware/validateBody.js";

export const surveyRouter = Router();

const submitSurveyInput = z.array(
	z.object({
		id: z.string(),
		answer: z.union([z.number(), z.string()]),
	}),
);

surveyRouter.get("/", requireStudent, cacheGet(), async (_req, res) => {
	const questions = await SurveyQuestion.find().sort({ order: 1 }).lean();

	return res.api(
		200,
		questions.map(({ _id, type, question }) => ({
			id: _id.toString(),
			type,
			question,
		})),
	);
});

surveyRouter.post(
	"/submit",
	requireStudent,
	validateBody(submitSurveyInput),
	async (req, res) => {
		const student = await Student.findById(req.user!.sub).select(
			"surveySubmittedAt",
		);
		if (!student) {
			throw createHttpError(404, "Student not found");
		}
		if (student.surveySubmittedAt) {
			throw createHttpError(409, "Survey already submitted");
		}

		const answers = req.body as {
			id: string;
			answer: number | string;
		}[];
		const ids = answers.map((a) => a.id);
		if (ids.some((id) => !Types.ObjectId.isValid(id))) {
			throw createHttpError(400, "Invalid question id");
		}

		const questions = await SurveyQuestion.find({ _id: { $in: ids } }).lean();
		const questionCount = await SurveyQuestion.countDocuments();
		if (questions.length !== questionCount || ids.length !== questionCount) {
			throw createHttpError(400, "All survey questions must be answered");
		}

		const answersMap: Record<string, number | string> = {};
		for (const question of questions) {
			const entry = answers.find((a) => a.id === question._id.toString());
			const answer = entry!.answer;
			const isValid =
				question.type === "point"
					? typeof answer === "number" && answer >= -2 && answer <= 2
					: true;

			if (!isValid) {
				throw createHttpError(
					400,
					`Invalid answer for question ${question._id.toString()}`,
				);
			}
			answersMap[question._id.toString()] = answer;
		}

		const submission = await SurveyResponse.create({ answers: answersMap });
		await Student.findByIdAndUpdate(req.user!.sub, {
			surveySubmittedAt: new Date(),
		});

		return res.api(201, { id: submission.id });
	},
);
