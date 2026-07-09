<script setup lang="ts">
import type { PDFFont } from "pdf-lib";
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
	building: null | { name: string; shortCode?: string; shortName?: string };
};

type Booth = {
	id: string;
	refId?: string;
	boothCode: string;
	name: string;
	category: string;
	qrCode: string;
	startTime: string;
	endTime: string;
	location: Location;
};

type EventRecord = {
	id: string;
	refId?: string;
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
const isDownloadingQrZip = ref(false);
const tab = ref(route.query.tab === "events" ? "events" : "booths");
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "short",
});

function formatLocation(item: { location: Location }) {
	if (!item.location) return "-";

	return [
		item.location.building?.shortName ??
			item.location.building?.shortCode ??
			item.location.building?.name,
		item.location.floor,
		item.location.room,
	]
		.filter(Boolean)
		.join(" - ");
}

function formatDateTime(value: string) {
	return dateTimeFormatter.format(new Date(value));
}

function fileName(value: string) {
	return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "booth";
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
	const lines: string[] = [];
	let line = "";

	for (const word of text.split(/\s+/)) {
		const next = [line, word].filter(Boolean).join(" ");
		if (font.widthOfTextAtSize(next, size) <= maxWidth) {
			line = next;
		} else {
			if (line) lines.push(line);
			line = word;
		}
	}

	return [...lines, line].filter(Boolean);
}

async function dataUrlBytes(dataUrl: string) {
	return new Uint8Array(await (await fetch(dataUrl)).arrayBuffer());
}

async function createBoothQrPdf(booth: Booth) {
	const [{ default: QRCode }, { PDFDocument, StandardFonts }] =
		await Promise.all([import("qrcode"), import("pdf-lib")]);
	const qrDataUrl = await QRCode.toDataURL(booth.qrCode, {
		errorCorrectionLevel: "H",
		margin: 2,
		width: 1600,
	});
	const pdf = await PDFDocument.create();
	const page = pdf.addPage([595.28, 841.89]);
	const font = await pdf.embedFont(StandardFonts.HelveticaBold);
	const image = await pdf.embedPng(await dataUrlBytes(qrDataUrl));
	const titleSize = 48;
	const codeSize = 28;
	const titleLines = wrapText(booth.name, font, titleSize, 510).slice(0, 3);
	const titleY = 750;
	const codeY = titleY - titleLines.length * 54 - 20;
	const qrSize = 425;

	titleLines.forEach((line, index) => {
		page.drawText(line, {
			x: (595.28 - font.widthOfTextAtSize(line, titleSize)) / 2,
			y: titleY - index * 54,
			size: titleSize,
			font,
		});
	});
	page.drawText(booth.boothCode, {
		x: (595.28 - font.widthOfTextAtSize(booth.boothCode, codeSize)) / 2,
		y: codeY,
		size: codeSize,
		font,
	});
	page.drawImage(image, {
		x: (595.28 - qrSize) / 2,
		y: codeY - qrSize - 35,
		width: qrSize,
		height: qrSize,
	});

	const bytes = await pdf.save();
	const buffer = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(buffer).set(bytes);

	return new Blob([buffer], { type: "application/pdf" });
}

async function downloadQrZip() {
	isDownloadingQrZip.value = true;
	error.value = "";

	try {
		const { default: JSZip } = await import("jszip");
		const zip = new JSZip();

		for (const booth of booths.value) {
			zip.file(
				`${fileName(`${booth.boothCode}-${booth.name}`)}.pdf`,
				await createBoothQrPdf(booth),
			);
		}

		const blob = await zip.generateAsync({ type: "blob" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = "booth-qr-codes.zip";
		link.click();
		URL.revokeObjectURL(url);
	} catch (caught) {
		error.value =
			caught instanceof Error ? caught.message : "Failed to download QR ZIP";
	} finally {
		isDownloadingQrZip.value = false;
	}
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
			<div class="flex items-center justify-between gap-4">
				<div class="w-28" />
				<Tabs v-model="tab" default-value="booths">
					<TabsList>
						<TabsTrigger value="booths">Booths</TabsTrigger>
						<TabsTrigger value="events">Events</TabsTrigger>
					</TabsList>
				</Tabs>
				<Button variant="outline" as-child>
					<RouterLink to="/batch-import">Batch import</RouterLink>
				</Button>
			</div>

			<section v-if="tab === 'booths'" class="flex flex-col gap-4">
				<header class="flex flex-col gap-1">
					<div class="flex items-center justify-between gap-4">
						<div class="flex flex-col gap-1">
							<h1 class="text-2xl font-semibold tracking-tight">Booths</h1>
							<p class="text-sm text-muted-foreground">All booth records.</p>
						</div>

						<div class="flex gap-2">
							<Button
								variant="outline"
								:disabled="
									isLoading || booths.length === 0 || isDownloadingQrZip
								"
								@click="downloadQrZip"
							>
								{{ isDownloadingQrZip ? "Creating ZIP..." : "Download QR ZIP" }}
							</Button>
							<Button as-child>
								<RouterLink to="/booths/new">Create booth</RouterLink>
							</Button>
						</div>
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
							<TableHead>Ref ID</TableHead>
							<TableHead>Code</TableHead>
							<TableHead class="w-2/5">Name</TableHead>
							<TableHead>Category</TableHead>
							<TableHead class="w-32">Location</TableHead>
							<TableHead>Time</TableHead>
							<TableHead class="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						<TableRow v-for="booth in booths" :key="booth.id">
							<TableCell>{{ booth.refId || "-" }}</TableCell>
							<TableCell class="font-medium">{{ booth.boothCode }}</TableCell>
							<TableCell class="w-2/5">{{ booth.name }}</TableCell>
							<TableCell>{{ formatInterest(booth.category) }}</TableCell>
							<TableCell class="w-32 whitespace-nowrap text-xs">{{
								formatLocation(booth)
							}}</TableCell>
							<TableCell>{{ booth.startTime }} - {{ booth.endTime }}</TableCell>
							<TableCell>
								<div class="flex justify-end gap-2">
									<Button size="sm" variant="outline" as-child>
										<RouterLink
											:to="`/booths/${booth.id}/qr`"
											target="_blank"
											rel="noopener"
											>Show QR Code</RouterLink
										>
									</Button>
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
