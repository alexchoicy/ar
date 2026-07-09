<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
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
	FieldSeparator,
	FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { INTERESTS_MAP } from "@/interests";
import { fetchBuildings } from "@/lib/buildings";
import type { Building } from "@/lib/buildings";
import { getInputFile, replacePreviewUrl } from "@/lib/image-preview";
import { SOCIAL_FIELDS, validateSocialLink } from "@/lib/social-links";
import { uploadFile } from "@/lib/uploads";

type BoothResponse = {
	id: string;
	refId?: string;
	boothCode: string;
	name: string;
	overview: string;
	category: string;
	programmes: Array<{
		id?: string;
		title: string;
		summary: string;
		imageFileName: string;
		imageUrl: string;
	}>;
	socialLinks: Array<{
		type: string;
		url: string;
	}>;
	startTime: string;
	endTime: string;
	location: null | {
		floor?: string;
		room?: string;
		building: null | { id: string };
	};
};

const route = useRoute();
const router = useRouter();
const isCreate = computed(() => route.path === "/booths/new");
const error = ref("");
const isLoading = ref(true);
const isSaving = ref(false);
const buildings = ref<Building[]>([]);
const selectedBuilding = computed({
	get: () =>
		buildings.value.find((building) => building.id === form.buildingId),
	set: (building: Building | undefined) => {
		form.buildingId = building?.id ?? "";
	},
});
const interests = Object.entries(INTERESTS_MAP).map(([value, label]) => ({
	value,
	label,
}));
const selectedInterest = computed({
	get: () => interests.find((interest) => interest.value === form.category),
	set: (interest: (typeof interests)[number] | undefined) => {
		form.category = interest?.value ?? "";
	},
});
const programmes = ref<
	Array<{
		id: string;
		title: string;
		summary: string;
		currentImageFileName: string;
		currentImageUrl: string;
		previewImageUrl: string;
		imageFile: File | null;
	}>
>([]);
const form = reactive({
	refId: "",
	boothCode: "",
	name: "",
	overview: "",
	category: "",
	buildingId: "",
	floor: "",
	room: "",
	startTime: "",
	endTime: "",
	social_instagram: "",
	social_facebook: "",
	social_youtube: "",
	social_twitter: "",
	social_rednote: "",
	social_website: "",
});

onMounted(async () => {
	try {
		buildings.value = await fetchBuildings();

		if (isCreate.value) return;

		const boothResponse = await fetch(`/api/booths/${route.params.id}`);
		const boothBody = await boothResponse.json();

		if (!boothResponse.ok)
			throw new Error(boothBody.error ?? "Failed to load booth");

		const booth = boothBody.data as BoothResponse;
		form.refId = booth.refId ?? "";
		form.boothCode = booth.boothCode;
		form.name = booth.name;
		form.overview = booth.overview;
		form.category = booth.category;
		for (const link of booth.socialLinks) {
			if (link.type in form) form[link.type as keyof typeof form] = link.url;
		}
		form.buildingId = booth.location?.building?.id ?? "";
		form.floor = booth.location?.floor ?? "";
		form.room = booth.location?.room ?? "";
		form.startTime = booth.startTime;
		form.endTime = booth.endTime;
		programmes.value = booth.programmes.map((programme) => ({
			id: programme.id ?? "",
			title: programme.title,
			summary: programme.summary,
			currentImageFileName: programme.imageFileName,
			currentImageUrl: programme.imageUrl,
			previewImageUrl: "",
			imageFile: null,
		}));
	} catch (caught) {
		error.value =
			caught instanceof Error ? caught.message : "Failed to load booth";
	} finally {
		isLoading.value = false;
	}
});

onBeforeUnmount(() => {
	for (const programme of programmes.value) {
		if (programme.previewImageUrl)
			URL.revokeObjectURL(programme.previewImageUrl);
	}
});

function addProgramme() {
	programmes.value.push({
		id: "",
		title: "",
		summary: "",
		currentImageFileName: "",
		currentImageUrl: "",
		previewImageUrl: "",
		imageFile: null,
	});
}

function removeProgramme(index: number) {
	const [programme] = programmes.value.splice(index, 1);
	if (programme?.previewImageUrl)
		URL.revokeObjectURL(programme.previewImageUrl);
}

function selectProgrammeImage(index: number, event: Event) {
	const programme = programmes.value[index];
	if (!programme) return;

	const file = getInputFile(event);
	programme.imageFile = file;
	programme.previewImageUrl = replacePreviewUrl(
		programme.previewImageUrl,
		file,
	);
}

function resetProgrammeImage(index: number) {
	const programme = programmes.value[index];
	if (!programme) return;

	programme.imageFile = null;
	programme.previewImageUrl = replacePreviewUrl(
		programme.previewImageUrl,
		null,
	);
}

function validateForm() {
	if (!form.name.trim()) return "Name is required.";
	if (!form.overview.trim()) return "Overview is required.";
	if (!form.category) return "Category is required.";
	if (!form.buildingId) return "Building is required.";
	if (!form.startTime) return "Start time is required.";
	if (!form.endTime) return "End time is required.";
	if (form.startTime >= form.endTime)
		return "Start time must be before end time.";

	for (const field of SOCIAL_FIELDS) {
		const socialError = form[field.name].trim()
			? validateSocialLink(field.name, form[field.name])
			: "";
		if (socialError) return socialError;
	}

	const incompleteProgramme = programmes.value.find(
		(programme) =>
			!programme.title.trim() ||
			!programme.summary.trim() ||
			(!programme.currentImageFileName && !programme.imageFile),
	);

	if (incompleteProgramme)
		return "Each programme needs a title, summary, and image.";

	return "";
}

async function save() {
	error.value = validateForm();
	if (error.value) {
		return;
	}

	isSaving.value = true;

	try {
		const response = await fetch(
			isCreate.value ? "/api/booths" : `/api/booths/${route.params.id}`,
			{
				method: isCreate.value ? "POST" : "PUT",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					...form,
					socialLinks: SOCIAL_FIELDS.map(({ name }) => ({
						type: name,
						url: form[name],
					})).filter((link) => link.url.trim()),
					programmes: programmes.value.map((programme) => ({
						...(programme.id ? { id: programme.id } : {}),
						title: programme.title,
						summary: programme.summary,
						imageFileName:
							programme.imageFile?.name ?? programme.currentImageFileName,
					})),
				}),
			},
		);
		const body = await response.json();

		if (!response.ok) throw new Error(body.error ?? "Failed to save booth");

		await Promise.all(
			(body.data.programmeUploadUrls ?? []).map(
				async (item: { index: number; uploadUrl: string }) => {
					const file = programmes.value[item.index]?.imageFile;
					if (!file) return;

					await uploadFile(
						item.uploadUrl,
						file,
						"Failed to upload programme image",
					);
				},
			),
		);

		await router.push("/");
	} catch (caught) {
		error.value =
			caught instanceof Error ? caught.message : "Failed to save booth";
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
						{{ isCreate ? "Create booth" : "Edit booth" }}
					</h1>
					<p class="text-sm text-muted-foreground">
						{{ isCreate ? "Add a new booth." : "Update booth details." }}
					</p>
				</div>

				<Button type="button" variant="outline" @click="router.push('/')"
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

						<Field v-if="!isCreate">
							<FieldLabel for="booth-code">Code</FieldLabel>
							<Input
								id="booth-code"
								v-model="form.boothCode"
								disabled
								required
							/>
						</Field>

						<Field>
							<FieldLabel for="name">Name</FieldLabel>
							<Input id="name" v-model="form.name" required />
						</Field>

						<Field>
							<FieldLabel for="overview">Overview</FieldLabel>
							<Textarea id="overview" v-model="form.overview" required />
						</Field>

						<Field>
							<FieldLabel for="category">Category</FieldLabel>
							<Combobox v-model="selectedInterest" by="value">
								<ComboboxAnchor as-child>
									<ComboboxTrigger as-child>
										<Button
											id="category"
											type="button"
											variant="outline"
											class="w-full justify-between"
										>
											<span class="truncate">
												{{ selectedInterest?.label ?? "Select category" }}
											</span>
										</Button>
									</ComboboxTrigger>
								</ComboboxAnchor>
								<ComboboxList class="w-(--reka-combobox-trigger-width)">
									<ComboboxInput placeholder="Search category..." />
									<ComboboxEmpty>No category found.</ComboboxEmpty>
									<ComboboxViewport class="max-h-72">
										<ComboboxGroup>
											<ComboboxItem
												v-for="interest in interests"
												:key="interest.value"
												:value="interest"
											>
												{{ interest.label }}
												<ComboboxItemIndicator />
											</ComboboxItem>
										</ComboboxGroup>
									</ComboboxViewport>
								</ComboboxList>
							</Combobox>
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

						<div class="grid gap-4 sm:grid-cols-2">
							<Field>
								<FieldLabel for="floor">Floor</FieldLabel>
								<Input id="floor" v-model="form.floor" />
							</Field>

							<Field>
								<FieldLabel for="room">Room</FieldLabel>
								<Input id="room" v-model="form.room" />
							</Field>
						</div>

						<div class="grid gap-4 sm:grid-cols-2">
							<Field>
								<FieldLabel for="start-time">Start time</FieldLabel>
								<Input
									id="start-time"
									v-model="form.startTime"
									type="time"
									required
								/>
							</Field>

							<Field>
								<FieldLabel for="end-time">End time</FieldLabel>
								<Input
									id="end-time"
									v-model="form.endTime"
									type="time"
									required
								/>
							</Field>
						</div>
					</FieldGroup>
				</FieldSet>

				<FieldSeparator />

				<FieldSet>
					<FieldLegend>Social Links</FieldLegend>
					<div class="grid gap-4 sm:grid-cols-2">
						<Field v-for="field in SOCIAL_FIELDS" :key="field.name">
							<FieldLabel :for="field.name">{{ field.label }}</FieldLabel>
							<Input :id="field.name" v-model="form[field.name]" type="url" />
						</Field>
					</div>
				</FieldSet>

				<FieldSeparator />

				<FieldSet>
					<div class="flex items-center justify-between gap-4">
						<FieldLegend>Programmes</FieldLegend>
						<Button type="button" variant="outline" @click="addProgramme"
							>Add programme</Button
						>
					</div>

					<div
						v-for="(programme, index) in programmes"
						:key="index"
						class="flex flex-col gap-4 rounded-md border p-4"
					>
						<div class="flex justify-end">
							<Button
								type="button"
								variant="destructive"
								size="sm"
								@click="removeProgramme(index)"
							>
								Remove
							</Button>
						</div>

						<Field>
							<FieldLabel :for="`programme-title-${index}`">Title</FieldLabel>
							<Input
								:id="`programme-title-${index}`"
								v-model="programme.title"
								required
							/>
						</Field>

						<Field>
							<FieldLabel :for="`programme-summary-${index}`"
								>Summary</FieldLabel
							>
							<Textarea
								:id="`programme-summary-${index}`"
								v-model="programme.summary"
								required
							/>
						</Field>

						<Field>
							<FieldLabel :for="`programme-image-${index}`">Image</FieldLabel>
							<FieldDescription>
								Preferred 16:9. Recommended size: 1920x1080.
							</FieldDescription>
							<img
								v-if="programme.previewImageUrl || programme.currentImageUrl"
								:src="programme.previewImageUrl || programme.currentImageUrl"
								:alt="programme.title"
								class="aspect-video w-full rounded-md border object-cover"
							/>
							<div class="flex gap-2">
								<Input
									:id="`programme-image-${index}`"
									type="file"
									accept="image/*"
									@change="selectProgrammeImage(index, $event)"
								/>
								<Button
									v-if="programme.imageFile"
									type="button"
									variant="outline"
									@click="resetProgrammeImage(index)"
								>
									Reset
								</Button>
							</div>
						</Field>
					</div>
				</FieldSet>

				<FieldError v-if="error">{{ error }}</FieldError>

				<Button type="submit" :disabled="isSaving">
					{{ isSaving ? "Saving..." : isCreate ? "Create" : "Save" }}
				</Button>
			</FieldGroup>
		</form>
	</main>
</template>
