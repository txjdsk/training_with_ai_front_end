<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getProfile, logout } from "@/lib/api";
import { clearProfileCache } from "@/router";

const router = useRouter();
const isLoading = ref(true);
const errorMessage = ref("");
const profile = ref<{ id: number; username: string; role: string; created_at: string } | null>(null);

async function loadProfile() {
  isLoading.value = true;
  errorMessage.value = "";
  try {
    profile.value = await getProfile();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "个人信息加载失败。";
  } finally {
    isLoading.value = false;
  }
}

async function handleLogout() {
  try {
    await logout();
  } finally {
    clearProfileCache();
    await router.push("/login");
  }
}

onMounted(loadProfile);
</script>

<template>
  <div class="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-6 px-6 py-12">
    <header class="space-y-2">
      <h1 class="text-3xl font-semibold text-slate-900">账号信息</h1>
      <p class="text-sm text-slate-600">查看账号角色与注册时间。</p>
    </header>

    <p v-if="errorMessage" class="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ errorMessage }}
    </p>

    <Card class="rounded-3xl">
      <CardHeader>
        <CardTitle>当前账号</CardTitle>
        <CardDescription>当前登录的账号信息</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div v-if="isLoading" class="text-sm text-slate-500">加载中...</div>
        <div v-else-if="profile" class="grid gap-4 text-sm text-slate-700 sm:grid-cols-2">
          <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p class="text-xs text-slate-500">用户 ID</p>
            <p class="mt-1 text-base font-semibold text-slate-900">{{ profile.id }}</p>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p class="text-xs text-slate-500">用户名</p>
            <p class="mt-1 text-base font-semibold text-slate-900">{{ profile.username }}</p>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p class="text-xs text-slate-500">角色</p>
            <p class="mt-1 text-base font-semibold text-slate-900">{{ profile.role }}</p>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p class="text-xs text-slate-500">注册时间</p>
            <p class="mt-1 text-base font-semibold text-slate-900">{{ profile.created_at }}</p>
          </div>
        </div>
      </CardContent>
    </Card>

    <div class="flex flex-wrap gap-3">
      <Button variant="outline" @click="loadProfile">刷新信息</Button>
      <Button variant="destructive" @click="handleLogout">退出登录</Button>
    </div>
  </div>
</template>
