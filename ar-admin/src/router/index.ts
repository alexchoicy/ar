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
			path: "/booths/new",
			component: () => import("@/views/EditBoothView.vue"),
		},
		{
			path: "/booths/:id/edit",
			component: () => import("@/views/EditBoothView.vue"),
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
