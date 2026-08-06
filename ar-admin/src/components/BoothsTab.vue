<script setup lang="ts">
import type { PDFFont } from "pdf-lib";
import { onMounted, ref } from "vue";

import qrBackgroundUrl from "@/assets/qr-background.png";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatInterest } from "@/interests";

type Booth = {
	id: string;
	boothCode: string;
	boothArea: string;
	boothNumber: string;
	name: string;
	category: string;
	qrCode: string;
	startTime: string;
	endTime: string;
	location: null | {
		floor: string;
		room: string;
		building: null | { name: string; shortCode?: string; shortName?: string };
	};
};

const booths = ref<Booth[]>([]);
const error = ref("");
const isLoading = ref(true);
const deletingId = ref("");
const isDownloadingQrZip = ref(false);

function formatLocation(booth: Booth) {
	if (!booth.location) return "-";

	return [
		booth.location.building?.shortName ??
			booth.location.building?.shortCode ??
			booth.location.building?.name,
		booth.location.floor,
		booth.location.room,
	]
		.filter(Boolean)
		.join(" - ");
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

function fitPdfText(
	text: string,
	font: PDFFont,
	maxWidth: number,
	maxHeight: number,
) {
	for (let size = 40; size >= 18; size--) {
		const lines = wrapText(text, font, size, maxWidth);
		const lineHeight = size * 1.1;
		if (
			lines.length * lineHeight <= maxHeight &&
			lines.every((line) => font.widthOfTextAtSize(line, size) <= maxWidth)
		) {
			return { lines, lineHeight, size };
		}
	}

	return {
		lines: wrapText(text, font, 18, maxWidth).slice(0, 5),
		lineHeight: 19.8,
		size: 18,
	};
}

async function createBoothQrPdf(booth: Booth, backgroundBytes: ArrayBuffer) {
	const [{ default: QRCode }, { PDFDocument, StandardFonts }] =
		await Promise.all([import("qrcode"), import("pdf-lib")]);
	const qrDataUrl = await QRCode.toDataURL(booth.qrCode, {
		color: { light: "#00000000" },
		errorCorrectionLevel: "H",
		margin: 2,
		width: 1600,
	});
	const pdf = await PDFDocument.create();
	const pageWidth = 595.28;
	const pageHeight = 841.89;
	const page = pdf.addPage([pageWidth, pageHeight]);
	const font = await pdf.embedFont(StandardFonts.HelveticaBold);
	const background = await pdf.embedPng(backgroundBytes);
	const qrImage = await pdf.embedPng(qrDataUrl);
	const textX = (20 / 397) * pageWidth;
	const textTop = (97 / 559) * pageHeight;
	const textWidth = (357 / 397) * pageWidth;
	const textHeight = (73 / 559) * pageHeight;
	const textBottom = pageHeight - textTop - textHeight;
	const { lines, lineHeight, size } = fitPdfText(
		booth.name,
		font,
		textWidth,
		textHeight,
	);
	const totalTextHeight = lines.length * lineHeight;
	const firstLineY =
		textBottom + (textHeight - totalTextHeight) / 2 + totalTextHeight - size;
	const qrSize = (273 / 397) * pageWidth;
	const qrX = (62 / 397) * pageWidth;
	const qrY = pageHeight - (189 / 559) * pageHeight - qrSize;

	page.drawImage(background, {
		x: 0,
		y: 0,
		width: pageWidth,
		height: pageHeight,
	});
	lines.forEach((line, index) => {
		page.drawText(line, {
			x: textX + (textWidth - font.widthOfTextAtSize(line, size)) / 2,
			y: firstLineY - index * lineHeight,
			size,
			font,
		});
	});
	page.drawImage(qrImage, {
		x: qrX,
		y: qrY,
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
		const backgroundResponse = await fetch(qrBackgroundUrl);
		if (!backgroundResponse.ok) throw new Error("Failed to load QR background");
		const backgroundBytes = await backgroundResponse.arrayBuffer();
		const zip = new JSZip();

		for (const booth of booths.value) {
			zip.file(
				`${fileName(`${booth.boothCode}-${booth.name}`)}.pdf`,
				await createBoothQrPdf(booth, backgroundBytes),
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
</script>

<template>
	<section class="flex flex-col gap-4">
		<header class="flex items-center justify-between gap-4">
			<div>
				<h1 class="text-2xl font-semibold tracking-tight">Booths</h1>
				<p class="text-sm text-muted-foreground">All booth records.</p>
			</div>
			<div class="flex gap-2">
				<Button
					variant="outline"
					:disabled="isLoading || booths.length === 0 || isDownloadingQrZip"
					@click="downloadQrZip"
				>
					{{ isDownloadingQrZip ? "Creating ZIP..." : "Download QR ZIP" }}
				</Button>
				<Button as-child
					><RouterLink to="/booths/new">Create booth</RouterLink></Button
				>
			</div>
		</header>

		<p v-if="isLoading" class="text-sm text-muted-foreground">
			Loading booths...
		</p>
		<p v-else-if="error" class="text-sm text-destructive">{{ error }}</p>
		<p v-else-if="booths.length === 0" class="text-sm text-muted-foreground">
			No booths yet.
		</p>

		<Table v-else>
			<TableHeader>
				<TableRow>
					<TableHead>Area</TableHead>
					<TableHead>Booth number</TableHead>
					<TableHead class="w-2/5">Name</TableHead>
					<TableHead>Category</TableHead>
					<TableHead class="w-32">Location</TableHead>
					<TableHead>Time</TableHead>
					<TableHead class="text-right">Actions</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				<TableRow v-for="booth in booths" :key="booth.id">
					<TableCell>{{ booth.boothArea || "-" }}</TableCell>
					<TableCell class="font-medium">{{
						booth.boothNumber || "-"
					}}</TableCell>
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
								<RouterLink :to="`/booths/${booth.id}/edit`">Edit</RouterLink>
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
</template>
