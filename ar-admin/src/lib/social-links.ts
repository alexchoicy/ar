export const SOCIAL_FIELDS = [
	{ name: "social_instagram", label: "Instagram" },
	{ name: "social_facebook", label: "Facebook" },
	{ name: "social_youtube", label: "YouTube" },
	{ name: "social_twitter", label: "Twitter" },
	{ name: "social_rednote", label: "RedNote" },
	{ name: "social_website", label: "Website" },
] as const;

export type SocialFieldName = (typeof SOCIAL_FIELDS)[number]["name"];

const socialHosts: Record<SocialFieldName, string[]> = {
	social_instagram: ["instagram.com"],
	social_facebook: ["facebook.com", "fb.com"],
	social_youtube: ["youtube.com", "youtu.be"],
	social_twitter: ["twitter.com", "x.com"],
	social_rednote: ["xiaohongshu.com", "xhslink.com", "rednote.com"],
	social_website: [],
};

export function socialLabel(type: string) {
	return SOCIAL_FIELDS.find((field) => field.name === type)?.label ?? type;
}

export function validateSocialLink(type: string, value: string) {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return `Invalid ${socialLabel(type)} URL`;
	}

	const hosts = socialHosts[type as SocialFieldName];
	const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
	if (
		hosts?.length &&
		!hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))
	) {
		return `${socialLabel(type)} URL must be on ${hosts.join(" or ")}`;
	}

	return "";
}
