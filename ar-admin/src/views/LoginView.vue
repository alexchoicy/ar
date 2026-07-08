<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";

import { login } from "@/auth";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const router = useRouter();
const name = ref("");
const password = ref("");
const error = ref("");
const isLoading = ref(false);

async function submit() {
	error.value = "";
	isLoading.value = true;

	try {
		if (await login(name.value, password.value)) {
			await router.push("/");
			return;
		}

		error.value = "Invalid name or password.";
	} catch {
		error.value = "Could not sign in. Try again.";
	} finally {
		isLoading.value = false;
	}
}
</script>

<template>
	<main
		class="flex min-h-screen items-center justify-center bg-muted px-6 py-12"
	>
		<form class="w-full max-w-sm" @submit.prevent="submit">
			<Card>
				<CardHeader class="text-center">
					<CardTitle>Admin login</CardTitle>
					<CardDescription>Sign in to manage AR content.</CardDescription>
				</CardHeader>

				<CardContent>
					<FieldGroup>
						<Field :data-invalid="error ? true : undefined">
							<FieldLabel for="name">Name</FieldLabel>
							<Input
								id="name"
								v-model="name"
								autocomplete="username"
								:disabled="isLoading"
								:aria-invalid="error ? true : undefined"
								required
							/>
						</Field>

						<Field :data-invalid="error ? true : undefined">
							<FieldLabel for="password">Password</FieldLabel>
							<Input
								id="password"
								v-model="password"
								type="password"
								autocomplete="current-password"
								:disabled="isLoading"
								:aria-invalid="error ? true : undefined"
								required
							/>
						</Field>

						<FieldError v-if="error">{{ error }}</FieldError>
					</FieldGroup>
				</CardContent>

				<CardFooter>
					<Button class="w-full" type="submit" :disabled="isLoading">
						{{ isLoading ? "Signing in..." : "Sign in" }}
					</Button>
				</CardFooter>
			</Card>
		</form>
	</main>
</template>
