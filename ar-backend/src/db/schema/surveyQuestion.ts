import { Schema, model } from "mongoose";
import type { InferSchemaType } from "mongoose";

const surveyQuestionSchema = new Schema({
	key: { type: String, required: true, unique: true, trim: true },
	type: { type: String, required: true, enum: ["point", "text"] },
	question: { type: String, required: true, trim: true },
	order: { type: Number, required: true },
});

export type SurveyQuestionDocument = InferSchemaType<
	typeof surveyQuestionSchema
>;

export const SurveyQuestion = model<SurveyQuestionDocument>(
	"SurveyQuestion",
	surveyQuestionSchema,
);
