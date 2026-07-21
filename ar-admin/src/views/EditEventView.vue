<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { Button } from "@/components/ui/button";
import {
	Combobox,
	ComboboxAnchor,
	ComboboxEmpty,
	ComboboxGroup,
	ComboboxInput,
	ComboboxItem,
	ComboboxItemIndicator,
	ComboboxList,
	ComboboxTrigger,
	ComboboxViewport,
} from "@/components/ui/combobox";
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
import { Textarea } from "@/components/ui/textarea";
import { fetchBuildings } from "@/lib/buildings";
import type { Building } from "@/lib/buildings";

type EventResponse = {
	id: string;
	refId?: string;
	title: string;
	description: string;
	startsAt: string;
	endsAt: string;
	location: null | {
		floor?: string;
		room?: string;
		building: null | { id: string };
	};
};

const route = useRoute();
const router = useRouter();
const isCreate = computed(() => route.path === "/events/new");
const error = ref("");
const isLoading = ref(true);
const isSaving = ref(false);
const buildings = ref<Building[]>([]);
const form = reactive({
	refId: "",
	title: "",
	description: "",
	buildingId: "",
	floor: "",
	room: "",
	startsAt: "",
	endsAt: "",
});

const selectedBuilding = computed({
	get: () =>
		buildings.value.find((building) => building.id === form.buildingId),
	set: (building: Building | undefined) => {
		form.buildingId = building?.id ?? "";
	},
});

function toDatetimeInput(value: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";

	return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
		.toISOString()
		.slice(0, 16);
}

function toIsoDatetime(value: string) {
	return new Date(value).toISOString();
}

onMounted(async () => {
	try {
		buildings.value = await fetchBuildings();

		if (isCreate.value) return;

		const eventResponse = await fetch(
			`/api/events/${route.params.id}?includeHidden=true`,
		);
		const eventBody = await eventResponse.json();

		if (!eventResponse.ok)
			throw new Error(eventBody.error ?? "Failed to load event");

		const event = eventBody.data as EventResponse;
		form.refId = event.refId ?? "";
		form.title = event.title;
		form.description = event.description;
		form.buildingId = event.location?.building?.id ?? "";
		form.floor = event.location?.floor ?? "";
		form.room = event.location?.room ?? "";
		form.startsAt = toDatetimeInput(event.startsAt);
		form.endsAt = toDatetimeInput(event.endsAt);
	} catch (caught) {
		error.value =
			caught instanceof Error ? caught.message : "Failed to load event";
	} finally {
		isLoading.value = false;
	}
});

function validateForm() {
	if (!form.title.trim()) return "Title is required.";
	if (!form.buildingId) return "Building is required.";
	if (!form.startsAt) return "Start time is required.";
	if (!form.endsAt) return "End time is required.";
	if (form.startsAt >= form.endsAt)
		return "Start time must be before end time.";

	return "";
}

async function save() {
	error.value = validateForm();
	if (error.value) return;

	isSaving.value = true;

	try {
		const response = await fetch(
			isCreate.value ? "/api/events" : `/api/events/${route.params.id}`,
			{
				method: isCreate.value ? "POST" : "PUT",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					...form,
					startsAt: toIsoDatetime(form.startsAt),
					endsAt: toIsoDatetime(form.endsAt),
				}),
			},
		);
		const body = await response.json();

		if (!response.ok) throw new Error(body.error ?? "Failed to save event");

		await router.push("/?tab=events");
	} catch (caught) {
		error.value =
			caught instanceof Error ? caught.message : "Failed to save event";
	} finally {
		isSaving.value = false;
	}
}
</script>

<template>
	<main class="min-h-screen bg-background px-6 py-8">
		<form
			class="mx-auto flex w-full max-w-5xl flex-col gap-6"
			@submit.prevent="save"
		>
			<header class="flex items-center justify-between gap-4">
				<div class="flex flex-col gap-1">
					<h1 class="text-2xl font-semibold tracking-tight">
						{{ isCreate ? "Create event" : "Edit event" }}
					</h1>
					<p class="text-sm text-muted-foreground">
						{{ isCreate ? "Add a new event." : "Update event details." }}
					</p>
				</div>

				<Button
					type="button"
					variant="outline"
					@click="router.push('/?tab=events')"
					>Back</Button
				>
			</header>

			<p v-if="isLoading" class="text-sm text-muted-foreground">Loading...</p>

			<FieldGroup v-if="!isLoading">
				<FieldSet>
					<FieldLegend>Details</FieldLegend>
					<FieldGroup>
						<Field>
							<FieldLabel for="ref-id">Ref ID</FieldLabel>
							<Input id="ref-id" v-model="form.refId" />
							<FieldDescription>
								Unique ID used by Excel batch import to update this record.
							</FieldDescription>
						</Field>

						<Field>
							<FieldLabel for="title">Title</FieldLabel>
							<Input id="title" v-model="form.title" required />
						</Field>

						<Field>
							<FieldLabel for="description">Description</FieldLabel>
							<Textarea id="description" v-model="form.description" />
						</Field>
					</FieldGroup>
				</FieldSet>

				<FieldSet>
					<FieldLegend>Location & Time</FieldLegend>
					<FieldGroup>
						<Field>
							<FieldLabel for="building">Building</FieldLabel>
							<Combobox v-model="selectedBuilding" by="id">
								<ComboboxAnchor as-child>
									<ComboboxTrigger as-child>
										<Button
											id="building"
											type="button"
											variant="outline"
											class="w-full justify-between"
										>
											<span class="truncate">
												{{
													selectedBuilding
														? `${selectedBuilding.shortCode} - ${selectedBuilding.name}`
														: "Select building"
												}}
											</span>
										</Button>
									</ComboboxTrigger>
								</ComboboxAnchor>
								<ComboboxList class="w-(--reka-combobox-trigger-width)">
									<ComboboxInput placeholder="Search building..." />
									<ComboboxEmpty>No building found.</ComboboxEmpty>
									<ComboboxViewport class="max-h-72">
										<ComboboxGroup>
											<ComboboxItem
												v-for="building in buildings"
												:key="building.id"
												:value="building"
											>
												{{ building.shortCode }} - {{ building.name }}
												<ComboboxItemIndicator />
											</ComboboxItem>
										</ComboboxGroup>
									</ComboboxViewport>
								</ComboboxList>
							</Combobox>
						</Field>

						<FieldGroup class="grid gap-4 sm:grid-cols-2">
							<Field>
								<FieldLabel for="floor">Floor</FieldLabel>
								<Input id="floor" v-model="form.floor" />
							</Field>

							<Field>
								<FieldLabel for="room">Room</FieldLabel>
								<Input id="room" v-model="form.room" />
							</Field>
						</FieldGroup>

						<FieldGroup class="grid gap-4 sm:grid-cols-2">
							<Field>
								<FieldLabel for="starts-at">Starts at</FieldLabel>
								<Input
									id="starts-at"
									v-model="form.startsAt"
									type="datetime-local"
									required
								/>
							</Field>

							<Field>
								<FieldLabel for="ends-at">Ends at</FieldLabel>
								<Input
									id="ends-at"
									v-model="form.endsAt"
									type="datetime-local"
									required
								/>
							</Field>
						</FieldGroup>
					</FieldGroup>
				</FieldSet>

				<FieldError v-if="error">{{ error }}</FieldError>

				<Button type="submit" :disabled="isSaving">
					{{ isSaving ? "Saving..." : isCreate ? "Create" : "Save" }}
				</Button>
			</FieldGroup>
		</form>
	</main>
</template>
