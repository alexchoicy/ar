<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";

import { Button } from "@/components/ui/button";

type EventRecord = {
	id: string;
	refId?: string;
	title: string;
	startsAt: string;
	endsAt: string;
};

const faculties = [
	["arts_social_sciences", "Arts and Social Sciences"],
	["business", "Business"],
	["chinese_medicine", "Chinese Medicine"],
	["communication", "Communication"],
	["creative_arts", "Creative Arts"],
	["science", "Science"],
	[
		"transdisciplinary_undergraduate_programmes",
		"Transdisciplinary Programmes",
	]
] as const;

const events = ref<EventRecord[]>([]);
const faculty = ref<(typeof faculties)[number][0]>(faculties[0][0]);
const studyYear = ref("1");
const suggestedEventIds = ref<string[]>([]);
const eventToAdd = ref("");
const error = ref("");
const isLoading = ref(true);
const isSaving = ref(false);
const hasLoaded = ref(false);
let suggestionRequest = 0;
const availableEvents = computed(() =>
	events.value.filter((event) => !suggestedEventIds.value.includes(event.id)),
);
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
	timeZone: "Asia/Hong_Kong",
	dateStyle: "medium",
	timeStyle: "short",
});

function byRefId(a: EventRecord, b: EventRecord) {
	return (a.refId || "~").localeCompare(b.refId || "~", undefined, {
		numeric: true,
	});
}

function eventById(eventId: string) {
	return events.value.find((event) => event.id === eventId);
}

function formatEventTime(eventId: string) {
	const event = eventById(eventId);
	return event
		? `${dateTimeFormatter.format(new Date(event.startsAt))} - ${dateTimeFormatter.format(new Date(event.endsAt))} (HKT)`
		: "";
}

async function loadSuggestion() {
	const request = ++suggestionRequest;
	isLoading.value = true;
	hasLoaded.value = false;
	eventToAdd.value = "";
	suggestedEventIds.value = [];
	error.value = "";

	try {
		const response = await fetch(
			`/api/suggestion/${faculty.value}/${studyYear.value}`,
		);
		const body = await response.json();

		if (!response.ok && response.status !== 404) {
			throw new Error(body.error ?? "Failed to load suggested route");
		}

		if (request !== suggestionRequest) return;
		suggestedEventIds.value =
			response.status === 404
				? []
				: body.data
						.filter((event: { optional: boolean }) => !event.optional)
						.map((event: { id: string }) => event.id);
		hasLoaded.value = true;
	} catch (caught) {
		if (request !== suggestionRequest) return;
		error.value =
			caught instanceof Error
				? caught.message
				: "Failed to load suggested route";
	} finally {
		if (request === suggestionRequest) isLoading.value = false;
	}
}

function addEvent() {
	if (!eventToAdd.value) return;
	suggestedEventIds.value.push(eventToAdd.value);
	eventToAdd.value = "";
}

function moveEvent(index: number, offset: number) {
	const target = index + offset;
	if (target < 0 || target >= suggestedEventIds.value.length) return;

	const eventId = suggestedEventIds.value.splice(index, 1)[0]!;
	suggestedEventIds.value.splice(target, 0, eventId);
}

async function save() {
	if (!hasLoaded.value) return;
	isSaving.value = true;
	error.value = "";

	try {
		const response = await fetch(
			`/api/suggestion/${faculty.value}/${studyYear.value}`,
			{
				method: "PUT",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ eventIds: suggestedEventIds.value }),
			},
		);
		const body = await response.json();
		if (!response.ok)
			throw new Error(body.error ?? "Failed to save suggested route");
	} catch (caught) {
		error.value =
			caught instanceof Error
				? caught.message
				: "Failed to save suggested route";
	} finally {
		isSaving.value = false;
	}
}

watch([faculty, studyYear], loadSuggestion);

onMounted(async () => {
	try {
		const response = await fetch("/api/events?includeHidden=true");
		const body = await response.json();
		if (!response.ok) throw new Error(body.error ?? "Failed to load events");
		events.value = [...body.data].sort(byRefId);
		await loadSuggestion();
	} catch (caught) {
		error.value =
			caught instanceof Error ? caught.message : "Failed to load events";
		isLoading.value = false;
	}
});
</script>

<template>
	<section class="flex flex-col gap-4">
		<header class="flex items-end justify-between gap-4">
			<div>
				<h1 class="text-2xl font-semibold tracking-tight">Suggested Route</h1>
				<p class="text-sm text-muted-foreground">
					Choose the events and their visit order for each student group.
				</p>
			</div>
			<Button :disabled="!hasLoaded || isLoading || isSaving" @click="save">
				{{ isSaving ? "Saving..." : "Save route" }}
			</Button>
		</header>

		<div class="flex flex-wrap gap-4 rounded-lg border p-4">
			<label class="flex min-w-64 flex-1 flex-col gap-2 text-sm font-medium">
				Faculty
				<select
					v-model="faculty"
					class="h-9 rounded-md border bg-background px-3 font-normal"
				>
					<option v-for="item in faculties" :key="item[0]" :value="item[0]">
						{{ item[1] }}
					</option>
				</select>
			</label>
			<label class="flex min-w-48 flex-col gap-2 text-sm font-medium">
				Study year
				<select
					v-model="studyYear"
					class="h-9 rounded-md border bg-background px-3 font-normal"
				>
					<option value="1">Year 1</option>
					<option value="2">Years 2-3</option>
				</select>
			</label>
		</div>

		<p v-if="error" class="text-sm text-destructive">{{ error }}</p>
		<p v-if="isLoading" class="text-sm text-muted-foreground">
			Loading route...
		</p>

		<div v-else class="flex flex-col gap-3">
			<div class="flex gap-2">
				<select
					v-model="eventToAdd"
					class="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
				>
					<option value="">Select an event to add</option>
					<option
						v-for="event in availableEvents"
						:key="event.id"
						:value="event.id"
					>
						{{ event.refId ? `${event.refId} - ` : "" }}{{ event.title }}
					</option>
				</select>
				<Button variant="outline" :disabled="!eventToAdd" @click="addEvent"
					>Add</Button
				>
			</div>

			<p
				v-if="suggestedEventIds.length === 0"
				class="text-sm text-muted-foreground"
			>
				No events in this route yet.
			</p>
			<div
				v-for="(eventId, index) in suggestedEventIds"
				:key="eventId"
				class="flex items-center gap-3 rounded-lg border p-3"
			>
				<span class="w-7 text-center text-sm text-muted-foreground">{{
					index + 1
				}}</span>
				<div class="min-w-0 flex-1">
					<p class="font-medium">
						{{ eventById(eventId)?.title ?? "Unknown event" }}
					</p>
					<p class="text-sm text-muted-foreground">
						{{ formatEventTime(eventId) }}
					</p>
				</div>
				<Button
					size="sm"
					variant="outline"
					:disabled="index === 0"
					@click="moveEvent(index, -1)"
					>Up</Button
				>
				<Button
					size="sm"
					variant="outline"
					:disabled="index === suggestedEventIds.length - 1"
					@click="moveEvent(index, 1)"
					>Down</Button
				>
				<Button
					size="sm"
					variant="destructive"
					@click="suggestedEventIds.splice(index, 1)"
					>Remove</Button
				>
			</div>
		</div>
	</section>
</template>
