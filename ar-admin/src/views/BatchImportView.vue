<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { INTERESTS_MAP, formatInterest } from "@/interests";
import { fetchBuildings } from "@/lib/buildings";
import type { Building } from "@/lib/buildings";
import { SOCIAL_FIELDS, socialLabel, validateSocialLink } from "@/lib/social-links";
import { uploadFile } from "@/lib/uploads";

type Location = null | {
	floor?: string;
	room?: string;
	building: null | { id: string; shortCode: string; name: string };
};

type CurrentBooth = {
	id: string;
	refId?: string;
	name: string;
	overview: string;
	category: string;
	startTime: string;
	endTime: string;
	programmes: Array<{
		title: string;
		summary: string;
		imageFileName: string;
	}>;
	socialLinks: Array<{ type: string; url: string }>;
	location: Location;
};

type CurrentEvent = {
	id: string;
	refId?: string;
	title: string;
	description: string;
	startsAt: string;
	endsAt: string;
	location: Location;
};

type ProgrammeImport = {
	title: string;
	summary: string;
	imageFileName: string;
};

type ImportStatus = "new" | "update" | "same" | "invalid";

type ImportCard = {
	uid: string;
	kind: "booth" | "event";
	refId: string;
	name: string;
	overview: string;
	buildingCode: string;
	floor: string;
	room: string;
	start: string;
	end: string;
	category: string;
	programmes: ProgrammeImport[];
	socialLinks: Array<{ type: string; url: string }>;
	existingId: string;
	status: ImportStatus;
	errors: string[];
	diff: string[];
};

const router = useRouter();
const buildings = ref<Building[]>([]);
const currentBooths = ref<CurrentBooth[]>([]);
const currentEvents = ref<CurrentEvent[]>([]);
const cards = ref<ImportCard[]>([]);
const imageFiles = ref<File[]>([]);
const error = ref("");
const message = ref("");
const isLoading = ref(true);
const isImporting = ref(false);

const imageFilesByName = computed(
	() => new Map(imageFiles.value.map((file) => [file.name, file])),
);
const importableCards = computed(() =>
	cards.value.filter(
		(card) => card.status === "new" || card.status === "update",
	),
);
const boothCards = computed(() =>
	cards.value.filter((card) => card.kind === "booth"),
);
const eventCards = computed(() =>
	cards.value.filter((card) => card.kind === "event"),
);
const hktDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
	timeZone: "Asia/Hong_Kong",
	dateStyle: "medium",
	timeStyle: "short",
});

onMounted(async () => {
	await loadImportData();
});

async function loadImportData() {
	try {
		const [loadedBuildings, boothsResponse, eventsResponse] = await Promise.all(
			[fetchBuildings(), fetch("/api/booths"), fetch("/api/events")],
		);
		const [boothsBody, eventsBody] = await Promise.all([
			boothsResponse.json(),
			eventsResponse.json(),
		]);

		if (!boothsResponse.ok)
			throw new Error(boothsBody.error ?? "Failed to load booths");
		if (!eventsResponse.ok)
			throw new Error(eventsBody.error ?? "Failed to load events");

		buildings.value = loadedBuildings;
		currentBooths.value = boothsBody.data;
		currentEvents.value = eventsBody.data;
	} catch (caught) {
		error.value =
			caught instanceof Error ? caught.message : "Failed to load import data";
	} finally {
		isLoading.value = false;
	}
}

function text(value: unknown) {
	return String(value ?? "")
		.replaceAll("\r\n", "\n")
		.replaceAll("\r", "\n")
		.trim();
}

function normalizeTime(value: unknown) {
	const raw = text(value);
	const match = raw.match(/^(\d{1,2}):(\d{2})$/);
	if (!match) return raw;

	const [, hours, minutes] = match;
	return `${hours!.padStart(2, "0")}:${minutes!}`;
}

function normalizeDateTime(value: unknown) {
	const raw = text(value).replace(" ", "T");
	const valueWithOffset = raw ? `${raw}+08:00` : "";
	const date = new Date(valueWithOffset);

	return Number.isNaN(date.getTime()) ? "" : valueWithOffset;
}

function comparableDateTime(value: string) {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function isValidTime(value: string) {
	const match = value.match(/^(\d{2}):(\d{2})$/);
	if (!match) return false;

	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	return hours < 24 && minutes < 60;
}

function isValidDateTime(value: string) {
	return Boolean(value) && !Number.isNaN(new Date(value).getTime());
}

function hasValidStartAndEnd(card: ImportCard) {
	return card.kind === "booth"
		? isValidTime(card.start) && isValidTime(card.end)
		: isValidDateTime(card.start) && isValidDateTime(card.end);
}

function startsBeforeEnd(card: ImportCard) {
	return card.kind === "booth"
		? card.start < card.end
		: new Date(card.start).getTime() < new Date(card.end).getTime();
}

function displayTime(card: ImportCard) {
	if (card.kind === "booth" || !hasValidStartAndEnd(card))
		return `${card.start || "-"} - ${card.end || "-"}`;

	return `${hktDateTimeFormatter.format(new Date(card.start))} - ${hktDateTimeFormatter.format(new Date(card.end))}`;
}

function displayLocation(card: ImportCard) {
	return [card.buildingCode, card.floor, card.room].filter(Boolean).join(" / ");
}

function statusClass(status: ImportStatus) {
	return {
		new: "border-green-200 bg-green-50 text-green-700",
		update: "border-blue-200 bg-blue-50 text-blue-700",
		invalid: "border-destructive/30 bg-destructive/10 text-destructive",
		same: "border-muted bg-muted text-muted-foreground",
	}[status];
}

function sameJson(left: unknown, right: unknown) {
	return JSON.stringify(left) === JSON.stringify(right);
}

function rowValues(workbook: XLSX.WorkBook, sheetName: string) {
	const sheet = workbook.Sheets[sheetName];
	if (!sheet) return [];

	return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
		defval: "",
		raw: false,
	});
}

function hasRowContent(row: Record<string, unknown>, codeField: string) {
	return Object.entries(row).some(
		([key, value]) => key !== codeField && Boolean(text(value)),
	);
}

function createCard(
	row: Record<string, unknown>,
	kind: ImportCard["kind"],
	codeField: "booth_code" | "event_code",
): ImportCard {
	return {
		uid: crypto.randomUUID(),
		kind,
		refId: text(row[codeField]),
		name: text(row.name),
		overview: text(row.overview),
		buildingCode: text(row.building),
		floor: text(row.floor),
		room: text(row.room),
		start: "",
		end: "",
		category: "",
		programmes: [],
		socialLinks: [],
		existingId: "",
		status: "new",
		errors: [],
		diff: [],
	};
}

function parseWorkbook(file: File) {
	error.value = "";
	message.value = "";
	const reader = new FileReader();

	reader.onload = () => {
		try {
			const workbook = XLSX.read(reader.result, { type: "array" });
			cards.value = [
				...rowValues(workbook, "booths")
					.filter((row) => hasRowContent(row, "booth_code"))
					.map(parseBoothRow),
				...rowValues(workbook, "event")
					.filter((row) => hasRowContent(row, "event_code"))
					.map(parseEventRow),
			];
			revalidateCards();
		} catch (caught) {
			error.value =
				caught instanceof Error ? caught.message : "Failed to read spreadsheet";
		}
	};

	reader.readAsArrayBuffer(file);
}

function parseBoothRow(row: Record<string, unknown>): ImportCard {
	const programmes = [1, 2, 3]
		.map((index) => ({
			title: text(row[`programme_${index}_title`]),
			summary: text(row[`programme_${index}_summary`]),
			imageFileName: text(row[`programme_${index}_image`]),
		}))
		.filter(
			(programme) =>
				programme.title || programme.summary || programme.imageFileName,
		);

	return {
		...createCard(row, "booth", "booth_code"),
		start: normalizeTime(row.start_time),
		end: normalizeTime(row.end_time),
		category: text(row.category),
		programmes,
		socialLinks: SOCIAL_FIELDS
			.map(({ name }) => ({ type: name, url: text(row[name]) }))
			.filter((link) => link.url),
	};
}

function parseEventRow(row: Record<string, unknown>): ImportCard {
	return {
		...createCard(row, "event", "event_code"),
		start: normalizeDateTime(row.start_date_time),
		end: normalizeDateTime(row.end_date_time),
	};
}

function boothSnapshot(card: ImportCard) {
	return {
		name: card.name,
		overview: card.overview,
		buildingCode: card.buildingCode,
		floor: card.floor,
		room: card.room,
		startTime: card.start,
		endTime: card.end,
		category: card.category,
		programmes: card.programmes,
		socialLinks: socialLinksSnapshot(card.socialLinks),
	};
}

function socialLinksSnapshot(links: Array<{ type: string; url: string }>) {
	return links.map(({ type, url }) => ({ type, url }));
}

function currentBoothSnapshot(booth: CurrentBooth) {
	return {
		name: booth.name,
		overview: booth.overview,
		buildingCode: booth.location?.building?.shortCode ?? "",
		floor: booth.location?.floor ?? "",
		room: booth.location?.room ?? "",
		startTime: booth.startTime,
		endTime: booth.endTime,
		category: booth.category,
		programmes: booth.programmes.map(({ title, summary, imageFileName }) => ({
			title,
			summary,
			imageFileName,
		})),
		socialLinks: socialLinksSnapshot(booth.socialLinks),
	};
}

function eventSnapshot(card: ImportCard) {
	return {
		title: card.name,
		description: card.overview,
		buildingCode: card.buildingCode,
		floor: card.floor,
		room: card.room,
		startsAt: comparableDateTime(card.start),
		endsAt: comparableDateTime(card.end),
	};
}

function currentEventSnapshot(event: CurrentEvent) {
	return {
		title: event.title,
		description: event.description,
		buildingCode: event.location?.building?.shortCode ?? "",
		floor: event.location?.floor ?? "",
		room: event.location?.room ?? "",
		startsAt: comparableDateTime(event.startsAt),
		endsAt: comparableDateTime(event.endsAt),
	};
}

function changedFields(
	next: Record<string, unknown>,
	current: Record<string, unknown>,
) {
	return Object.keys(next).filter((key) => !sameJson(next[key], current[key]));
}

function validateCard(card: ImportCard) {
	const errors: string[] = [];
	const building = buildings.value.find(
		(item) => item.shortCode === card.buildingCode,
	);
	const current =
		card.kind === "booth"
			? currentBooths.value.find((item) => item.refId === card.refId)
			: currentEvents.value.find((item) => item.refId === card.refId);
	const hasValidStart =
		card.kind === "booth"
			? isValidTime(card.start)
			: isValidDateTime(card.start);
	const hasValidEnd =
		card.kind === "booth" ? isValidTime(card.end) : isValidDateTime(card.end);

	if (!card.refId) errors.push("Missing code");
	if (!card.name) errors.push("Missing name");
	if (!card.overview) errors.push("Missing description");
	if (!building) errors.push(`Unknown building: ${card.buildingCode || "-"}`);
	if (!card.start) errors.push("Missing start time");
	else if (!hasValidStart) errors.push("Invalid start time");
	if (!card.end) errors.push("Missing end time");
	else if (!hasValidEnd) errors.push("Invalid end time");
	if (hasValidStart && hasValidEnd && !startsBeforeEnd(card))
		errors.push("Start time must be before end time");
	for (const link of card.socialLinks) {
		const linkError = validateSocialLink(link.type, link.url);
		if (linkError) errors.push(linkError);
	}

	if (card.kind === "booth") {
		if (!(card.category in INTERESTS_MAP))
			errors.push(`Unknown category: ${card.category || "-"}`);
		for (const [index, programme] of card.programmes.entries()) {
			if (!programme.title || !programme.summary || !programme.imageFileName) {
				errors.push("Incomplete programme");
				continue;
			}
			const existingImage =
				(current as CurrentBooth | undefined)?.programmes[index]
					?.imageFileName === programme.imageFileName;

			if (
				!existingImage &&
				!imageFilesByName.value.has(programme.imageFileName)
			)
				errors.push(`Missing image: ${programme.imageFileName}`);
		}
	}

	card.existingId = current?.id ?? "";
	card.errors = errors;

	if (errors.length) {
		card.status = "invalid";
		card.diff = [];
		return;
	}

	if (!current) {
		card.status = "new";
		card.diff = [];
		return;
	}

	const diff =
		card.kind === "booth"
			? changedFields(
					boothSnapshot(card),
					currentBoothSnapshot(current as CurrentBooth),
				)
			: changedFields(
					eventSnapshot(card),
					currentEventSnapshot(current as CurrentEvent),
				);

	card.diff = diff;
	card.status = diff.length ? "update" : "same";
}

function revalidateCards() {
	for (const card of cards.value) validateCard(card);
	cards.value = cards.value.filter((card) => card.status !== "same");
}

function selectSpreadsheet(event: Event) {
	const file = (event.target as HTMLInputElement).files?.[0];
	if (file) parseWorkbook(file);
}

function selectImages(files: FileList | null) {
	imageFiles.value = files ? Array.from(files) : [];
	revalidateCards();
}

function selectImageInput(event: Event) {
	selectImages((event.target as HTMLInputElement).files);
}

function dropImages(event: DragEvent) {
	event.preventDefault();
	selectImages(event.dataTransfer?.files ?? null);
}

function removeCard(card: ImportCard) {
	cards.value = cards.value.filter((item) => item.uid !== card.uid);
	revalidateCards();
}

function sectionCards(kind: ImportCard["kind"]) {
	return kind === "booth" ? boothCards.value : eventCards.value;
}

function buildingId(card: ImportCard) {
	return buildings.value.find(
		(building) => building.shortCode === card.buildingCode,
	)?.id;
}

async function saveImportRecord(
	card: ImportCard,
	url: string,
	body: Record<string, unknown>,
) {
	const response = await fetch(url, {
		method: card.existingId ? "PUT" : "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify(body),
	});
	const responseBody = await response.json();

	if (!response.ok)
		throw new Error(responseBody.error ?? `Failed to import ${card.refId}`);

	return responseBody;
}

async function saveBooth(card: ImportCard) {
	const body = await saveImportRecord(
		card,
		card.existingId ? `/api/booths/${card.existingId}` : "/api/booths",
		{
			refId: card.refId,
			name: card.name,
			overview: card.overview,
			category: card.category,
			buildingId: buildingId(card),
			floor: card.floor,
			room: card.room,
			startTime: card.start,
			endTime: card.end,
			socialLinks: card.socialLinks,
			programmes: card.programmes,
		},
	);

	await Promise.all(
		(body.data.programmeUploadUrls ?? []).map(
			async (item: { index: number; uploadUrl: string }) => {
				const fileName = card.programmes[item.index]?.imageFileName;
				const file = fileName
					? imageFilesByName.value.get(fileName)
					: undefined;
				if (!file) return;

				await uploadFile(item.uploadUrl, file, `Failed to upload ${file.name}`);
			},
		),
	);
}

async function saveEvent(card: ImportCard) {
	await saveImportRecord(
		card,
		card.existingId ? `/api/events/${card.existingId}` : "/api/events",
		{
			refId: card.refId,
			title: card.name,
			description: card.overview,
			buildingId: buildingId(card),
			floor: card.floor,
			room: card.room,
			startsAt: card.start,
			endsAt: card.end,
		},
	);
}

async function importCards() {
	revalidateCards();
	if (!importableCards.value.length) return;

	isImporting.value = true;
	error.value = "";
	message.value = "";
	const importedCount = importableCards.value.length;

	try {
		for (const card of importableCards.value) {
			if (card.kind === "booth") await saveBooth(card);
			else await saveEvent(card);
		}

		await loadImportData();
		revalidateCards();
		message.value = `Imported ${importedCount} records.`;
		cards.value = cards.value.filter((card) => card.status === "same");
	} catch (caught) {
		error.value = caught instanceof Error ? caught.message : "Import failed";
	} finally {
		isImporting.value = false;
	}
}
</script>

<template>
	<main class="min-h-screen bg-background px-6 py-8">
		<div class="mx-auto flex w-full max-w-6xl flex-col gap-6">
			<header class="flex items-center justify-between gap-4">
				<div class="flex flex-col gap-1">
					<h1 class="text-2xl font-semibold tracking-tight">Batch import</h1>
					<p class="text-sm text-muted-foreground">
						Import booths and events from the Excel workbook.
					</p>
				</div>

				<Button type="button" variant="outline" @click="router.push('/')"
					>Back</Button
				>
			</header>

			<p v-if="isLoading" class="text-sm text-muted-foreground">Loading...</p>

			<FieldGroup v-else>
				<FieldSet>
					<FieldLegend>Files</FieldLegend>
					<div class="grid gap-4 md:grid-cols-2">
						<Field>
							<FieldLabel for="spreadsheet">Excel workbook</FieldLabel>
							<FieldDescription>
								Uses the booths and event sheets.
							</FieldDescription>
							<Input
								id="spreadsheet"
								type="file"
								accept=".xlsx,.xls"
								@change="selectSpreadsheet"
							/>
						</Field>

						<Field>
							<FieldLabel for="images">Programme images</FieldLabel>
							<FieldDescription>
								Matched by exact filename from the workbook.
							</FieldDescription>
							<div
								class="rounded-md border border-dashed p-4"
								@dragover.prevent
								@drop="dropImages"
							>
								<Input
									id="images"
									type="file"
									accept="image/*"
									multiple
									@change="selectImageInput"
								/>
								<p class="mt-2 text-sm text-muted-foreground">
									{{ imageFiles.length }} images selected.
								</p>
							</div>
						</Field>
					</div>
				</FieldSet>

				<FieldError v-if="error">{{ error }}</FieldError>
				<p v-if="message" class="text-sm text-green-700">{{ message }}</p>

				<div class="flex items-center justify-between gap-4">
					<p class="text-sm text-muted-foreground">
						{{ cards.length }} cards, {{ importableCards.length }} ready to
						import.
					</p>
					<Button
						type="button"
						:disabled="isImporting || !importableCards.length"
						@click="importCards"
					>
						{{ isImporting ? "Importing..." : "Import ready cards" }}
					</Button>
				</div>

				<section
					v-for="section in [
						{ kind: 'booth' as const, title: 'Booths' },
						{ kind: 'event' as const, title: 'Events' },
					]"
					:key="section.kind"
					class="flex flex-col gap-3"
				>
					<header class="flex items-center justify-between border-b pb-2">
						<h2 class="text-lg font-semibold">{{ section.title }}</h2>
						<p class="text-sm text-muted-foreground">
							{{ sectionCards(section.kind).length }} items
						</p>
					</header>

					<div class="grid gap-4 md:grid-cols-2">
						<article
							v-for="card in sectionCards(section.kind)"
							:key="card.uid"
							class="flex flex-col gap-4 rounded-lg border p-4"
						>
							<div class="flex items-start justify-between gap-4">
								<div class="flex min-w-0 flex-col gap-1">
									<div class="flex flex-wrap items-center gap-2">
										<span
											class="rounded-full border px-2 py-0.5 text-xs font-medium uppercase"
											:class="statusClass(card.status)"
										>
											{{ card.status }}
										</span>
										<span class="font-mono text-xs text-muted-foreground">
											{{ card.refId }}
										</span>
									</div>
									<h3 class="truncate text-base font-semibold">
										{{ card.name }}
									</h3>
								</div>
								<Button
									type="button"
									variant="destructive"
									size="sm"
									@click="removeCard(card)"
								>
									Remove
								</Button>
							</div>

							<div class="grid gap-1 text-sm">
								<span
									class="text-xs font-medium uppercase text-muted-foreground"
								>
									Description
								</span>
								<p class="whitespace-pre-line">{{ card.overview || "-" }}</p>
							</div>

							<div
								class="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2 border-t pt-3 text-sm"
							>
								<div class="contents">
									<span class="text-muted-foreground">Where</span>
									<span class="font-medium">{{
										displayLocation(card) || "-"
									}}</span>
								</div>
								<div class="contents">
									<span class="text-muted-foreground">When (HKT)</span>
									<span class="break-all font-mono text-xs sm:text-sm">
										{{ displayTime(card) }}
									</span>
								</div>
								<div v-if="card.kind === 'booth'" class="contents">
									<span class="text-muted-foreground">Category</span>
									<span class="font-medium">{{
										formatInterest(card.category)
									}}</span>
								</div>
							</div>

							<div
								v-if="card.socialLinks.length"
								class="grid gap-2 border-t pt-3"
							>
								<h4 class="text-xs font-medium uppercase text-muted-foreground">
									Social links
								</h4>
								<div class="grid gap-1 text-sm">
									<div
										v-for="link in card.socialLinks"
										:key="link.type"
										class="grid grid-cols-[6.5rem_1fr] gap-x-3"
									>
										<span class="capitalize text-muted-foreground">
											{{ socialLabel(link.type) }}
										</span>
										<span class="break-all font-mono text-xs">{{
											link.url
										}}</span>
									</div>
								</div>
							</div>

							<div
								v-if="card.programmes.length"
								class="grid gap-2 border-t pt-3"
							>
								<h4 class="text-xs font-medium uppercase text-muted-foreground">
									Programmes
								</h4>
								<div
									v-for="programme in card.programmes"
									:key="programme.imageFileName"
									class="grid gap-1 rounded-md border p-3 text-sm"
								>
									<p class="font-medium">{{ programme.title || "Untitled" }}</p>
									<p class="whitespace-pre-line text-muted-foreground">
										{{ programme.summary || "-" }}
									</p>
									<p class="break-all font-mono text-xs text-muted-foreground">
										Image: {{ programme.imageFileName || "-" }}
									</p>
								</div>
							</div>

							<div
								v-if="card.diff.length"
								class="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700"
							>
								<span class="font-medium">Changed fields:</span>
								{{ card.diff.join(", ") }}
							</div>
							<div
								v-if="card.errors.length"
								class="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
							>
								<p class="font-medium">Fix before import</p>
								<ul class="mt-1 list-disc pl-4">
									<li v-for="item in card.errors" :key="item">{{ item }}</li>
								</ul>
							</div>
						</article>
					</div>
				</section>
			</FieldGroup>
		</div>
	</main>
</template>
