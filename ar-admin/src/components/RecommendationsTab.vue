<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import { Button } from "@/components/ui/button";

type Booth = {
	id: string;
	boothCode: string;
	boothArea: string;
	boothNumber: string;
	name: string;
};

const booths = ref<Booth[]>([]);
const recommendedBoothIds = ref<string[]>([]);
const boothToRecommend = ref("");
const error = ref("");
const isLoading = ref(true);
const isSaving = ref(false);
const hasLoaded = ref(false);
const availableBooths = computed(() =>
	booths.value.filter((booth) => !recommendedBoothIds.value.includes(booth.id)),
);

function boothById(boothId: string) {
	return booths.value.find((booth) => booth.id === boothId);
}

function addBooth() {
	if (!boothToRecommend.value) return;
	recommendedBoothIds.value.push(boothToRecommend.value);
	boothToRecommend.value = "";
}

function moveBooth(index: number, offset: number) {
	const target = index + offset;
	if (target < 0 || target >= recommendedBoothIds.value.length) return;

	const boothId = recommendedBoothIds.value.splice(index, 1)[0]!;
	recommendedBoothIds.value.splice(target, 0, boothId);
}

async function save() {
	if (!hasLoaded.value) return;
	isSaving.value = true;
	error.value = "";

	try {
		const response = await fetch("/api/recommendations", {
			method: "PUT",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ boothIds: recommendedBoothIds.value }),
		});
		const body = await response.json();
		if (!response.ok)
			throw new Error(body.error ?? "Failed to save recommendations");
	} catch (caught) {
		error.value =
			caught instanceof Error
				? caught.message
				: "Failed to save recommendations";
	} finally {
		isSaving.value = false;
	}
}

onMounted(async () => {
	try {
		const [boothsResponse, recommendationsResponse] = await Promise.all([
			fetch("/api/booths"),
			fetch("/api/recommendations"),
		]);
		const [boothsBody, recommendationsBody] = await Promise.all([
			boothsResponse.json(),
			recommendationsResponse.json(),
		]);
		if (!boothsResponse.ok)
			throw new Error(boothsBody.error ?? "Failed to load booths");
		if (!recommendationsResponse.ok)
			throw new Error(
				recommendationsBody.error ?? "Failed to load recommendations",
			);

		booths.value = boothsBody.data;
		recommendedBoothIds.value = recommendationsBody.data.map(
			(booth: Booth) => booth.id,
		);
		hasLoaded.value = true;
	} catch (caught) {
		error.value =
			caught instanceof Error
				? caught.message
				: "Failed to load recommendations";
	} finally {
		isLoading.value = false;
	}
});
</script>

<template>
	<section class="flex flex-col gap-4">
		<header class="flex items-end justify-between gap-4">
			<div>
				<h1 class="text-2xl font-semibold tracking-tight">Recommendations</h1>
				<p class="text-sm text-muted-foreground">
					Choose the recommended booths and their display order.
				</p>
			</div>
			<Button :disabled="!hasLoaded || isLoading || isSaving" @click="save">
				{{ isSaving ? "Saving..." : "Save recommendations" }}
			</Button>
		</header>

		<p v-if="error" class="text-sm text-destructive">{{ error }}</p>
		<p v-if="isLoading" class="text-sm text-muted-foreground">
			Loading recommendations...
		</p>

		<div v-else class="flex flex-col gap-3">
			<div class="flex gap-2">
				<select
					v-model="boothToRecommend"
					class="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
				>
					<option value="">Select a booth to add</option>
					<option
						v-for="booth in availableBooths"
						:key="booth.id"
						:value="booth.id"
					>
						{{ booth.boothArea }}{{ booth.boothNumber }} - {{ booth.name }}
					</option>
				</select>
				<Button
					variant="outline"
					:disabled="!boothToRecommend"
					@click="addBooth"
					>Add</Button
				>
			</div>

			<p
				v-if="recommendedBoothIds.length === 0"
				class="text-sm text-muted-foreground"
			>
				No recommended booths yet.
			</p>
			<div
				v-for="(boothId, index) in recommendedBoothIds"
				:key="boothId"
				class="flex items-center gap-3 rounded-lg border p-3"
			>
				<span class="w-7 text-center text-sm text-muted-foreground">{{
					index + 1
				}}</span>
				<div class="min-w-0 flex-1">
					<p class="font-medium">
						{{ boothById(boothId)?.name ?? "Unknown booth" }}
					</p>
					<p class="text-sm text-muted-foreground">
						{{ boothById(boothId)?.boothCode }}
					</p>
				</div>
				<Button
					size="sm"
					variant="outline"
					:disabled="index === 0"
					@click="moveBooth(index, -1)"
					>Up</Button
				>
				<Button
					size="sm"
					variant="outline"
					:disabled="index === recommendedBoothIds.length - 1"
					@click="moveBooth(index, 1)"
					>Down</Button
				>
				<Button
					size="sm"
					variant="destructive"
					@click="recommendedBoothIds.splice(index, 1)"
					>Remove</Button
				>
			</div>
		</div>
	</section>
</template>
