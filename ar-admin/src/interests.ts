export const INTERESTS_MAP = {
	academic_soc: "Academic",
	sports_athletics: "Sports",
	music_performing: "Music & Performing",
	arts_culture: "Arts & Culture",
	gaming_esports: "Gaming & Esports",
	hall_life: "Hall Life",
	social_service: "Social Service",
	debating_languages: "Languages",
	green_sustainability: "Sustainability",
	wellness_mindfulness: "Wellness",
	career_entrepreneur: "Career & Startups",
	media_journalism: "Media",
	student_services: "Student Services",
	office: "Office",
} as const;

export function formatInterest(interest: string) {
	return INTERESTS_MAP[interest as keyof typeof INTERESTS_MAP] ?? interest;
}
