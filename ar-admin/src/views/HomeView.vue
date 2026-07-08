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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatInterest } from "@/interests";

type Booth = {
	id: string;
	boothCode: string;
	name: string;
	category: string;
	startTime: string;
	endTime: string;
	location: null | {
		name: string;
		floor: string;
		room: string;
		building: null | { name: string };
	};
};

const booths = ref<Booth[]>([]);
const error = ref("");
const isLoading = ref(true);
const deletingId = ref("");
const tab = ref("booths");

function formatLocation(booth: Booth) {
	if (!booth.location) return "-";

	return [
		booth.location.building?.name,
		booth.location.floor,
		booth.location.room,
	]
		.filter(Boolean)
		.join(" - ");
}

onMounted(async () => {
	try {
		const response = await fetch("/api/booths");
		const body = await response.json();

		if (!response.ok) throw new Error(body.error ?? "Failed to load booths");

		booths.value = body.data;
	} catch (caught) {
		error.value =
			caught instanceof Error ? caught.message : "Failed to load booths";
	} finally {
		isLoading.value = false;
	}
});

async function deleteBooth(booth: Booth) {
	if (!window.confirm(`Delete ${booth.name}?`)) return;

	deletingId.value = booth.id;
	error.value = "";

	try {
		const response = await fetch(`/api/booths/${booth.id}`, {
			method: "DELETE",
			credentials: "include",
		});
		const body = await response.json();

		if (!response.ok) throw new Error(body.error ?? "Failed to delete booth");

		booths.value = booths.value.filter((item) => item.id !== booth.id);
	} catch (caught) {
		error.value =
			caught instanceof Error ? caught.message : "Failed to delete booth";
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

			<section v-else class="flex flex-col gap-1">
				<h1 class="text-2xl font-semibold tracking-tight">Events</h1>
				<p class="text-sm text-muted-foreground">No event tools yet.</p>
			</section>
		</div>
	</main>
</template>
