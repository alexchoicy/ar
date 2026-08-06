export const INTERESTS_MAP = {
	academic_soc: "Academic",
	hall_life: "Hall Life",
	interest_club: "Interest Club",
	office: "Office",
	gift: "Gift",
} as const;

export function formatInterest(interest: string) {
	return INTERESTS_MAP[interest as keyof typeof INTERESTS_MAP] ?? interest;
}
