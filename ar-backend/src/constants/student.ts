export const FACULTIES = [
	"arts_social_sciences",
	"business",
	"chinese_medicine",
	"communication",
	"creative_arts",
	"science",
	"transdisciplinary_undergraduate_programmes",
	"continuing_education",
] as const;

export const EMPTY_STUDENT_ID = "00000000";

export const INTERESTS = [
	"academic_soc",
	"sports_athletics",
	"music_performing",
	"arts_culture",
	"gaming_esports",
	"hall_life",
	"social_service",
	"debating_languages",
	"green_sustainability",
	"wellness_mindfulness",
	"career_entrepreneur",
	"media_journalism",
	"student_services",
	"office",
	"gift",
] as const;

export type Faculty = (typeof FACULTIES)[number];
export type Interest = (typeof INTERESTS)[number];
