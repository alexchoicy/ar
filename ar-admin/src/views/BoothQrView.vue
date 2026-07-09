<script setup lang="ts">
import QRCode from "qrcode";
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";

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
const title = computed(() => booth.value?.name ?? "Booth QR code");

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
			errorCorrectionLevel: "H",
			margin: 2,
			width: 1600,
		});
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
				<h2>{{ booth.name }}</h2>
				<p>{{ booth.boothCode }}</p>
				<img :src="qrDataUrl" :alt="`${booth.name} QR code`" />
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
	display: flex;
	width: 210mm;
	min-height: 297mm;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 8mm;
	background: white;
	color: black;
	text-align: center;
}

.qr-sheet h2 {
	max-width: 180mm;
	font-size: 22mm;
	font-weight: 700;
	line-height: 1.05;
}

.qr-sheet p {
	font-size: 10mm;
	font-weight: 600;
}

.qr-sheet img {
	width: 150mm;
	height: 150mm;
}

@media print {
	.qr-page {
		padding: 0;
	}
}
</style>
