import { createRouter, createWebHistory } from "vue-router";

import { isAdminLoggedIn } from "@/auth";

const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes: [
		{
			path: "/login",
			component: () => import("@/views/LoginView.vue"),
			meta: { public: true },
		},
		{
			path: "/",
			component: () => import("@/views/HomeView.vue"),
		},
		{
			path: "/batch-import",
			component: () => import("@/views/BatchImportView.vue"),
		},
		{
			path: "/booths/new",
			component: () => import("@/views/EditBoothView.vue"),
		},
		{
			path: "/booths/:id/edit",
			component: () => import("@/views/EditBoothView.vue"),
		},
		{
			path: "/booths/:id/qr",
			component: () => import("@/views/BoothQrView.vue"),
		},
		{
			path: "/events/new",
			component: () => import("@/views/EditEventView.vue"),
		},
		{
			path: "/events/:id/edit",
			component: () => import("@/views/EditEventView.vue"),
		},
	],
});

router.beforeEach(async (to) => {
	if (to.meta.public) {
		return true;
	}

	return (await isAdminLoggedIn()) ? true : "/login";
});

export default router;
