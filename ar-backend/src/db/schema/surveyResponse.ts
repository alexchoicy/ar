import { Schema, model } from "mongoose";
import type { InferSchemaType } from "mongoose";

const surveyResponseSchema = new Schema(
	{
		answers: { type: Map, of: Schema.Types.Mixed, required: true },
	},
	{ timestamps: true },
);

export type SurveyResponseDocument = InferSchemaType<
	typeof surveyResponseSchema
>;

export const SurveyResponse = model<SurveyResponseDocument>(
	"SurveyResponse",
	surveyResponseSchema,
);
