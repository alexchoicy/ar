<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";

import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatInterest } from "@/interests";

type Location = null | {
	name: string;
	floor: string;
	room: string;
	building: null | { name: string };
};

type Booth = {
	id: string;
	boothCode: string;
	name: string;
	category: string;
	startTime: string;
	endTime: string;
	location: Location;
};

type EventRecord = {
	id: string;
	title: string;
	startsAt: string;
	endsAt: string;
	location: Location;
};

const route = useRoute();
const booths = ref<Booth[]>([]);
const events = ref<EventRecord[]>([]);
const error = ref("");
const isLoading = ref(true);
const deletingId = ref("");
const tab = ref(route.query.tab === "events" ? "events" : "booths");
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "short",
});

function formatLocation(item: { location: Location }) {
	if (!item.location) return "-";

	return [item.location.building?.name, item.location.floor, item.location.room]
		.filter(Boolean)
		.join(" - ");
}

function formatDateTime(value: string) {
	return dateTimeFormatter.format(new Date(value));
}

onMounted(async () => {
	try {
		const [boothsResponse, eventsResponse] = await Promise.all([
			fetch("/api/booths"),
			fetch("/api/events"),
		]);
		const [boothsBody, eventsBody] = await Promise.all([
			boothsResponse.json(),
			eventsResponse.json(),
		]);

		if (!boothsResponse.ok)
			throw new Error(boothsBody.error ?? "Failed to load booths");
		if (!eventsResponse.ok)
			throw new Error(eventsBody.error ?? "Failed to load events");

		booths.value = boothsBody.data;
		events.value = eventsBody.data;
	} catch (caught) {
		error.value =
			caught instanceof Error ? caught.message : "Failed to load records";
	} finally {
		isLoading.value = false;
	}
});

async function deleteBooth(booth: Booth) {
	await deleteRecord(
		booth.id,
		booth.name,
		"booth",
		`/api/booths/${booth.id}`,
		() => {
			booths.value = booths.value.filter((item) => item.id !== booth.id);
		},
	);
}

async function deleteEvent(event: EventRecord) {
	await deleteRecord(
		event.id,
		event.title,
		"event",
		`/api/events/${event.id}`,
		() => {
			events.value = events.value.filter((item) => item.id !== event.id);
		},
	);
}

async function deleteRecord(
	id: string,
	name: string,
	label: string,
	url: string,
	remove: () => void,
) {
	if (!window.confirm(`Delete ${name}?`)) return;

	const message = `Failed to delete ${label}`;
	deletingId.value = id;
	error.value = "";

	try {
		const response = await fetch(url, {
			method: "DELETE",
			credentials: "include",
		});
		const body = await response.json();

		if (!response.ok) throw new Error(body.error ?? message);

		remove();
	} catch (caught) {
		error.value = caught instanceof Error ? caught.message : message;
	} finally {
		deletingId.value = "";
	}
}
</script>

<template>
	<main class="min-h-screen bg-background px-6 py-8">
		<div class="flex w-full flex-col gap-6">
			<Tabs v-model="tab" default-value="booths" class="flex flex-col gap-6">
				<TabsList class="mx-auto">
					<TabsTrigger value="booths">Booths</TabsTrigger>
					<TabsTrigger value="events">Events</TabsTrigger>
				</TabsList>
			</Tabs>

			<section v-if="tab === 'booths'" class="flex flex-col gap-4">
				<header class="flex flex-col gap-1">
					<div class="flex items-center justify-between gap-4">
						<div class="flex flex-col gap-1">
							<h1 class="text-2xl font-semibold tracking-tight">Booths</h1>
							<p class="text-sm text-muted-foreground">All booth records.</p>
						</div>

						<Button as-child>
							<RouterLink to="/booths/new">Create booth</RouterLink>
						</Button>
					</div>
				</header>

				<p v-if="isLoading" class="text-sm text-muted-foreground">
					Loading booths...
				</p>
				<p v-else-if="error" class="text-sm text-destructive">{{ error }}</p>
				<p
					v-else-if="booths.length === 0"
					class="text-sm text-muted-foreground"
				>
					No booths yet.
				</p>

				<Table v-else>
					<TableHeader>
						<TableRow>
							<TableHead>Code</TableHead>
							<TableHead>Name</TableHead>
							<TableHead>Category</TableHead>
							<TableHead>Location</TableHead>
							<TableHead>Time</TableHead>
							<TableHead class="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						<TableRow v-for="booth in booths" :key="booth.id">
							<TableCell class="font-medium">{{ booth.boothCode }}</TableCell>
							<TableCell>{{ booth.name }}</TableCell>
							<TableCell>{{ formatInterest(booth.category) }}</TableCell>
							<TableCell>{{ formatLocation(booth) }}</TableCell>
							<TableCell>{{ booth.startTime }} - {{ booth.endTime }}</TableCell>
							<TableCell>
								<div class="flex justify-end gap-2">
									<Button size="sm" variant="outline" as-child>
										<RouterLink :to="`/booths/${booth.id}/edit`"
											>Edit</RouterLink
										>
									</Button>
									<Button
										size="sm"
										variant="destructive"
										:disabled="deletingId === booth.id"
										@click="deleteBooth(booth)"
									>
										{{ deletingId === booth.id ? "Deleting..." : "Delete" }}
									</Button>
								</div>
							</TableCell>
						</TableRow>
					</TableBody>
				</Table>
			</section>

			<section v-else class="flex flex-col gap-4">
				<header class="flex flex-col gap-1">
					<div class="flex items-center justify-between gap-4">
						<div class="flex flex-col gap-1">
							<h1 class="text-2xl font-semibold tracking-tight">Events</h1>
							<p class="text-sm text-muted-foreground">All event records.</p>
						</div>

						<Button as-child>
							<RouterLink to="/events/new">Create event</RouterLink>
						</Button>
					</div>
				</header>

				<p v-if="isLoading" class="text-sm text-muted-foreground">
					Loading events...
				</p>
				<p v-else-if="error" class="text-sm text-destructive">{{ error }}</p>
				<p
					v-else-if="events.length === 0"
					class="text-sm text-muted-foreground"
				>
					No events yet.
				</p>

				<Table v-else>
					<TableHeader>
						<TableRow>
							<TableHead>Title</TableHead>
							<TableHead>Location</TableHead>
							<TableHead>Starts</TableHead>
							<TableHead>Ends</TableHead>
							<TableHead class="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						<TableRow v-for="event in events" :key="event.id">
							<TableCell class="font-medium">{{ event.title }}</TableCell>
							<TableCell>{{ formatLocation(event) }}</TableCell>
							<TableCell>{{ formatDateTime(event.startsAt) }}</TableCell>
							<TableCell>{{ formatDateTime(event.endsAt) }}</TableCell>
							<TableCell>
								<div class="flex justify-end gap-2">
									<Button size="sm" variant="outline" as-child>
										<RouterLink :to="`/events/${event.id}/edit`"
											>Edit</RouterLink
										>
									</Button>
									<Button
										size="sm"
										variant="destructive"
										:disabled="deletingId === event.id"
										@click="deleteEvent(event)"
									>
										{{ deletingId === event.id ? "Deleting..." : "Delete" }}
									</Button>
								</div>
							</TableCell>
						</TableRow>
					</TableBody>
				</Table>
			</section>
		</div>
	</main>
</template>
