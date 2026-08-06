<script setup lang="ts">
import { ref } from "vue";
import { useRoute } from "vue-router";

import BoothsTab from "@/components/BoothsTab.vue";
import EventsTab from "@/components/EventsTab.vue";
import RecommendationsTab from "@/components/RecommendationsTab.vue";
import SuggestedRouteTab from "@/components/SuggestedRouteTab.vue";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const route = useRoute();
const tabs = ["booths", "events", "suggested-route", "recommendations"];
const tab = ref(tabs.find((tab) => tab === route.query.tab) ?? "booths");
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
						<TabsTrigger value="suggested-route">Suggested Route</TabsTrigger>
						<TabsTrigger value="recommendations">Recommendations</TabsTrigger>
					</TabsList>
				</Tabs>
				<Button variant="outline" as-child>
					<RouterLink to="/batch-import">Batch import</RouterLink>
				</Button>
			</div>

			<BoothsTab v-if="tab === 'booths'" />
			<EventsTab v-else-if="tab === 'events'" />
			<SuggestedRouteTab v-else-if="tab === 'suggested-route'" />
			<RecommendationsTab v-else />
		</div>
	</main>
</template>
