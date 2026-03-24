<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { getProfile, logout } from "@/lib/api";
import { clearProfileCache } from "@/router";

type Profile = { id: number; username: string; role: string; created_at: string };

const route = useRoute();
const router = useRouter();
const profile = ref<Profile | null>(null);
const isLoadingProfile = ref(false);

const isTrainingActive = computed(() => route.name === "training-chat");
const showSidebar = computed(() => Boolean(route.meta.requiresAuth) && !isTrainingActive.value);
const isAdmin = computed(() => {
    const role = profile.value?.role ?? "";
    const normalized = role.toLowerCase();
    return normalized.includes("admin") || normalized.includes("root") || normalized.includes("manager");
});

const navigation = computed(() => {
    const base = [
        { label: "训练入口", to: "/training/select", key: "training-select" },
        { label: "训练记录", to: "/training/history", key: "training-history" },
        { label: "个人中心", to: "/profile", key: "profile" },
    ];

    if (!isAdmin.value) {
        return base;
    }

    return [
        ...base,
        { label: "用户管理", to: "/admin/users", key: "admin-users" },
        { label: "对话管理", to: "/admin/dialogues", key: "admin-dialogues" },
        { label: "提示词管理", to: "/admin/prompts", key: "admin-prompts" },
        { label: "提示词类别", to: "/admin/prompt-types", key: "admin-prompt-types" },
    ];
});

async function loadProfile() {
    if (!route.meta.requiresAuth) {
        profile.value = null;
        return;
    }
    isLoadingProfile.value = true;
    try {
        profile.value = await getProfile();
    } catch {
        profile.value = null;
    } finally {
        isLoadingProfile.value = false;
    }
}

async function handleLogout() {
    try {
        await logout();
    } finally {
        clearProfileCache();
        profile.value = null;
        await router.push("/login");
    }
}

watch(
    () => route.meta.requiresAuth,
    (requiresAuth) => {
        if (requiresAuth) {
            loadProfile();
        } else {
            profile.value = null;
        }
    },
    { immediate: true },
);

onMounted(loadProfile);
</script>

<template>
    <div class="min-h-dvh bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-slate-50 via-slate-100 to-slate-200">
        <div v-if="showSidebar" class="mx-auto flex min-h-dvh w-full max-w-7xl gap-6 px-6 py-6">
            <aside class="w-60 shrink-0 space-y-6">
                <div class="rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur">
                    <RouterLink to="/training/select" class="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                        Training With AI
                    </RouterLink>
                    <div class="mt-4 text-sm">
                        <p class="font-semibold text-slate-900">{{ profile?.username ?? "加载中" }}</p>
                        <p class="text-xs text-slate-500">{{ profile?.role ?? (isLoadingProfile ? "读取角色..." : "") }}</p>
                    </div>
                </div>

                <nav class="rounded-3xl border border-slate-200/70 bg-white/80 p-3 shadow-sm backdrop-blur">
                    <RouterLink
                        v-for="item in navigation"
                        :key="item.key"
                        :to="item.to"
                        class="flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 transition"
                        :class="route.name === item.key ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'"
                    >
                        <span>{{ item.label }}</span>
                        <span v-if="route.name === item.key" class="text-xs">当前</span>
                    </RouterLink>
                </nav>

                <div class="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur">
                    <Button class="w-full" variant="destructive" @click="handleLogout">退出登录</Button>
                </div>
            </aside>

            <main class="min-w-0 flex-1">
                <RouterView />
            </main>
        </div>

        <div v-else class="min-h-dvh">
            <RouterView />
        </div>
    </div>
</template>
