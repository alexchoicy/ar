<script setup lang="ts">
import QRCode from "qrcode";
import { computed, nextTick, onMounted, ref } from "vue";
import { useRoute } from "vue-router";

import qrBackgroundUrl from "@/assets/qr-background.png";
import { Button } from "@/components/ui/button";

type Booth = {
	id: string;
	name: string;
	boothCode: string;
	qrCode: string;
};

const route = useRoute();
const booth = ref<Booth | null>(null);
const error = ref("");
const isLoading = ref(true);
const qrDataUrl = ref("");
const boothNameElement = ref<HTMLElement | null>(null);
const title = computed(() => booth.value?.name ?? "Booth QR code");

function fitBoothName() {
	const element = boothNameElement.value;
	if (!element) return;

	let size = 48;
	element.style.fontSize = `${size}px`;
	while (
		size > 24 &&
		(element.scrollHeight > element.clientHeight ||
			element.scrollWidth > element.clientWidth)
	) {
		element.style.fontSize = `${--size}px`;
	}
}

function printPage() {
	window.print();
}

onMounted(async () => {
	try {
		const response = await fetch(`/api/booths/${route.params.id}`);
		const body = await response.json();

		if (!response.ok) throw new Error(body.error ?? "Failed to load booth");

		booth.value = body.data;
		qrDataUrl.value = await QRCode.toDataURL(body.data.qrCode, {
			color: { light: "#00000000" },
			errorCorrectionLevel: "H",
			margin: 2,
			width: 1600,
		});
		await nextTick();
		fitBoothName();
	} catch (caught) {
		error.value =
			caught instanceof Error ? caught.message : "Failed to load QR code";
	} finally {
		isLoading.value = false;
	}
});
</script>

<template>
	<main class="min-h-screen bg-background p-6 print:bg-white print:p-0">
		<div class="mx-auto flex w-full max-w-4xl flex-col gap-4 print:hidden">
			<div class="flex items-center justify-between gap-4">
				<div class="flex flex-col gap-1">
					<h1 class="text-2xl font-semibold tracking-tight">{{ title }}</h1>
					<p class="text-sm text-muted-foreground">
						Print this page on A4 paper.
					</p>
				</div>

				<Button type="button" @click="printPage">Print</Button>
			</div>

			<p v-if="isLoading" class="text-sm text-muted-foreground">Loading...</p>
			<p v-else-if="error" class="text-sm text-destructive">{{ error }}</p>
		</div>

		<section v-if="booth && qrDataUrl" class="qr-page">
			<div class="qr-sheet">
				<img class="qr-background" :src="qrBackgroundUrl" alt="" />
				<h2 ref="boothNameElement">{{ booth.name }}</h2>
				<img class="qr-code" :src="qrDataUrl" :alt="`${booth.name} QR code`" />
			</div>
		</section>
	</main>
</template>

<style scoped>
@page {
	size: A4 portrait;
	margin: 0;
}

.qr-page {
	display: flex;
	justify-content: center;
	padding: 24px;
}

.qr-sheet {
	position: relative;
	width: 210mm;
	height: 297mm;
	overflow: hidden;
	background: white;
	color: black;
}

.qr-sheet h2 {
	position: absolute;
	top: 17.3524%;
	left: 5.0378%;
	display: flex;
	width: 89.9244%;
	height: 13.059%;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	font-size: 48px;
	font-weight: 700;
	line-height: 1.05;
	text-align: center;
}

.qr-background {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
}

.qr-code {
	position: absolute;
	top: 33.8104%;
	left: 15.6171%;
	width: 68.7657%;
	aspect-ratio: 1;
}

@media print {
	.qr-page {
		padding: 0;
	}
}
</style>
