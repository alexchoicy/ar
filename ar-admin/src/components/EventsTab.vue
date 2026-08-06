<script setup lang="ts">
import { onMounted, ref } from "vue";

import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

type EventRecord = {
	id: string;
	refId?: string;
	title: string;
	startsAt: string;
	endsAt: string;
	location: null | {
		floor: string;
		room: string;
		building: null | { name: string; shortCode?: string; shortName?: string };
	};
};

const events = ref<EventRecord[]>([]);
const error = ref("");
const isLoading = ref(true);
const deletingId = ref("");
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
	timeZone: "Asia/Hong_Kong",
	dateStyle: "medium",
	timeStyle: "short",
});

function formatLocation(event: EventRecord) {
	if (!event.location) return "-";

	return [
		event.location.building?.shortName ??
			event.location.building?.shortCode ??
			event.location.building?.name,
		event.location.floor,
		event.location.room,
	]
		.filter(Boolean)
		.join(" - ");
}

function byRefId(a: EventRecord, b: EventRecord) {
	return (a.refId || "~").localeCompare(b.refId || "~", undefined, {
		numeric: true,
	});
}

async function deleteEvent(event: EventRecord) {
	if (!window.confirm(`Delete ${event.title}?`)) return;

	deletingId.value = event.id;
	error.value = "";

	try {
		const response = await fetch(`/api/events/${event.id}`, {
			method: "DELETE",
			credentials: "include",
		});
		const body = await response.json();
		if (!response.ok) throw new Error(body.error ?? "Failed to delete event");
		events.value = events.value.filter((item) => item.id !== event.id);
	} catch (caught) {
		error.value =
			caught instanceof Error ? caught.message : "Failed to delete event";
	} finally {
		deletingId.value = "";
	}
}

onMounted(async () => {
	try {
		const response = await fetch("/api/events?includeHidden=true");
		const body = await response.json();
		if (!response.ok) throw new Error(body.error ?? "Failed to load events");
		events.value = [...body.data].sort(byRefId);
	} catch (caught) {
		error.value =
			caught instanceof Error ? caught.message : "Failed to load events";
	} finally {
		isLoading.value = false;
	}
});
</script>

<template>
	<section class="flex flex-col gap-4">
		<header class="flex items-center justify-between gap-4">
			<div>
				<h1 class="text-2xl font-semibold tracking-tight">Events</h1>
				<p class="text-sm text-muted-foreground">All event records.</p>
			</div>
			<Button as-child
				><RouterLink to="/events/new">Create event</RouterLink></Button
			>
		</header>

		<p v-if="isLoading" class="text-sm text-muted-foreground">
			Loading events...
		</p>
		<p v-else-if="error" class="text-sm text-destructive">{{ error }}</p>
		<p v-else-if="events.length === 0" class="text-sm text-muted-foreground">
			No events yet.
		</p>

		<Table v-else>
			<TableHeader>
				<TableRow>
					<TableHead>Ref ID</TableHead>
					<TableHead class="w-2/5">Title</TableHead>
					<TableHead class="w-32">Location</TableHead>
					<TableHead>Starts</TableHead>
					<TableHead>Ends</TableHead>
					<TableHead class="text-right">Actions</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				<TableRow v-for="event in events" :key="event.id">
					<TableCell>{{ event.refId || "-" }}</TableCell>
					<TableCell class="w-2/5 font-medium">{{ event.title }}</TableCell>
					<TableCell class="w-32 whitespace-nowrap text-xs">{{
						formatLocation(event)
					}}</TableCell>
					<TableCell>{{
						dateTimeFormatter.format(new Date(event.startsAt))
					}}</TableCell>
					<TableCell>{{
						dateTimeFormatter.format(new Date(event.endsAt))
					}}</TableCell>
					<TableCell>
						<div class="flex justify-end gap-2">
							<Button size="sm" variant="outline" as-child>
								<RouterLink :to="`/events/${event.id}/edit`">Edit</RouterLink>
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
</template>
