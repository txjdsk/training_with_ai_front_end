<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getProfile, updateProfile, logout } from "@/lib/api";
import { clearProfileCache } from "@/router";

const router = useRouter();
const isLoading = ref(true);
const isUpdating = ref(false);
const errorMessage = ref("");
const updateMessage = ref("");
const successMessage = ref("");
const isDialogOpen = ref(false);
const profile = ref<{ id: number; username: string; role: string; created_at: string } | null>(null);

const form = reactive({
  username: "",
  old_password: "",
  new_password: "",
});

function formatDate(isoString: string | undefined | null) {
  if (!isoString) return "-";
  const d = new Date(isoString);
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).replace(/\//g, "-");
}

function openEditDialog() {
  updateMessage.value = "";
  successMessage.value = "";
  form.old_password = "";
  form.new_password = "";
  if (profile.value) {
    form.username = profile.value.username;
  }
  isDialogOpen.value = true;
}

function closeEditDialog() {
  isDialogOpen.value = false;
}

async function loadProfile() {
  isLoading.value = true;
  errorMessage.value = "";
  try {
    profile.value = await getProfile();
    form.username = profile.value.username;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "个人信息加载失败。";
  } finally {
    isLoading.value = false;
  }
}

async function handleUpdateProfile() {
  isUpdating.value = true;
  updateMessage.value = "";
  successMessage.value = "";
  try {
    const payload: { username?: string; old_password?: string; new_password?: string } = {};
    if (form.username !== profile.value?.username) {
      if (form.username.trim().length > 0) payload.username = form.username.trim();
    }
    if (form.old_password || form.new_password) {
      if (!form.old_password || !form.new_password) {
        throw new Error("修改密码需要同时填写旧密码与新密码。");
      }
      payload.old_password = form.old_password;
      payload.new_password = form.new_password;
    }

    if (Object.keys(payload).length === 0) {
      updateMessage.value = "没有修改任何信息。";
      isUpdating.value = false;
      return;
    }

    const updatedProfile = await updateProfile(payload);
    profile.value = updatedProfile;
    form.old_password = "";
    form.new_password = "";
    successMessage.value = "信息修改成功！将在1秒后关闭。";
    clearProfileCache(); // Refresh profile globally
    setTimeout(() => {
      closeEditDialog();
    }, 1000);
  } catch (error) {
    updateMessage.value = error instanceof Error ? error.message : "修改失败。";
  } finally {
    isUpdating.value = false;
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
            <p class="mt-1 text-base font-semibold text-slate-900">{{ formatDate(profile.created_at) }}</p>
          </div>
        </div>
      </CardContent>
    </Card>

    <div class="flex items-center gap-3">
      <Button variant="outline" @click="loadProfile">刷新信息</Button>
      <Button class="bg-slate-900 text-white hover:bg-slate-800" @click="openEditDialog">修改账号凭证</Button>
    </div>

    <!-- 弹出卡片：修改信息 -->
    <div v-if="isDialogOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-6 backdrop-blur-sm">
      <Card class="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl relative">
        <CardHeader class="bg-slate-50 border-b border-slate-100">
          <CardTitle>修改信息</CardTitle>
          <CardDescription>如果需要修改账号凭证，请在此操作。</CardDescription>
        </CardHeader>
        <CardContent class="space-y-5 pt-6 pb-2">
          <div class="space-y-2">
            <Label for="username">用户名</Label>
            <Input id="username" v-model="form.username" placeholder="请输入新用户名" />
          </div>
          <div class="space-y-2 pt-2">
            <h4 class="text-sm font-semibold text-slate-900">修改密码(选填)</h4>
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="space-y-1.5">
                <Label for="old_password" class="text-xs">旧密码</Label>
                <Input id="old_password" v-model="form.old_password" type="password" placeholder="不修改密码请留空" autocomplete="current-password" />
              </div>
              <div class="space-y-1.5">
                <Label for="new_password" class="text-xs">新密码</Label>
                <Input id="new_password" v-model="form.new_password" type="password" placeholder="不修改密码请留空" autocomplete="new-password" />
              </div>
            </div>
          </div>
          
          <!-- Messages -->
          <div class="h-6">
            <p v-if="updateMessage" class="m-0 text-sm text-destructive">{{ updateMessage }}</p>
            <p v-if="successMessage" class="m-0 text-sm text-emerald-600">{{ successMessage }}</p>
          </div>
        </CardContent>
        <CardFooter class="flex gap-3 justify-end border-t border-slate-100 bg-slate-50/50 p-4">
          <Button variant="outline" :disabled="isUpdating" @click="closeEditDialog">取消</Button>
          <Button :disabled="isUpdating" @click="handleUpdateProfile">{{ isUpdating ? "保存中..." : "保存修改" }}</Button>
        </CardFooter>
      </Card>
    </div>
  </div>
</template>
