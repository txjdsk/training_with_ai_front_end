<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createUser, deleteUser, getUsers, updateUser } from "@/lib/api";

type UserItem = { id: number; username: string; role: string; created_at: string };

const filters = reactive({
  username: "",
  role: "",
  start_time: "",
  end_time: "",
  page: 1,
  size: 10,
});
const users = ref<UserItem[]>([]);
const total = ref(0);
const isLoading = ref(false);
const errorMessage = ref("");
const isSaving = ref(false);
const isDeleting = ref<number | null>(null);
const isDialogOpen = ref(false);
const editingUserId = ref<number | null>(null);
const form = reactive({
  username: "",
  password: "",
  role: "user",
});

const isEditing = computed(() => editingUserId.value !== null);

async function fetchUsers() {
  isLoading.value = true;
  errorMessage.value = "";
  try {
    const result = await getUsers({
      username: filters.username || undefined,
      role: filters.role || undefined,
      start_time: filters.start_time || undefined,
      end_time: filters.end_time || undefined,
      page: filters.page,
      size: filters.size,
    });
    users.value = result.list ?? [];
    total.value = result.total ?? 0;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "用户列表加载失败。";
  } finally {
    isLoading.value = false;
  }
}

function resetFilters() {
  filters.username = "";
  filters.role = "";
  filters.start_time = "";
  filters.end_time = "";
  filters.page = 1;
  filters.size = 10;
  fetchUsers();
}

function openCreateDialog() {
  editingUserId.value = null;
  form.username = "";
  form.password = "";
  form.role = "user";
  isDialogOpen.value = true;
}

function openEditDialog(user: UserItem) {
  editingUserId.value = user.id;
  form.username = user.username;
  form.password = "";
  form.role = user.role;
  isDialogOpen.value = true;
}

function closeDialog() {
  isDialogOpen.value = false;
}

async function handleSave() {
  if (!form.username.trim()) {
    errorMessage.value = "请输入用户名。";
    return;
  }
  if (!isEditing.value && !form.password.trim()) {
    errorMessage.value = "请输入密码。";
    return;
  }
  if (!form.role.trim()) {
    errorMessage.value = "请输入角色。";
    return;
  }
  isSaving.value = true;
  errorMessage.value = "";
  try {
    if (isEditing.value && editingUserId.value) {
      const payload: { username: string; role: string; password?: string } = {
        username: form.username.trim(),
        role: form.role.trim(),
      };
      if (form.password.trim()) {
        payload.password = form.password.trim();
      }
      await updateUser(editingUserId.value, payload);
    } else {
      await createUser({
        username: form.username.trim(),
        password: form.password.trim(),
        role: form.role.trim(),
      });
    }
    closeDialog();
    await fetchUsers();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "保存失败。";
  } finally {
    isSaving.value = false;
  }
}

async function handleDelete(id: number) {
  if (!confirm("确定要删除该用户吗？")) {
    return;
  }
  isDeleting.value = id;
  errorMessage.value = "";
  try {
    await deleteUser(id);
    await fetchUsers();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "删除失败。";
  } finally {
    isDeleting.value = null;
  }
}

onMounted(() => {
  fetchUsers();
});
</script>

<template>
  <div class="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-8 px-6 py-12">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p class="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">用户管理</p>
        <h1 class="text-3xl font-semibold text-slate-900">用户筛选与维护</h1>
        <p class="mt-2 text-sm text-slate-600">
          按用户名、角色与时间筛选用户，支持新增、修改与删除。
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" @click="$router.push('/admin/dialogues')">用户对话管理</Button>
        <Button variant="outline" @click="$router.push('/admin/prompts')">提示词管理</Button>
        <Button @click="openCreateDialog">新增用户</Button>
      </div>
    </header>

    <Card class="rounded-3xl">
      <CardHeader>
        <CardTitle class="text-lg">筛选条件</CardTitle>
        <CardDescription>输入条件后查询用户列表。</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 md:grid-cols-4">
        <div class="space-y-2">
          <Label>用户名</Label>
          <Input v-model="filters.username" placeholder="输入用户名" />
        </div>
        <div class="space-y-2">
          <Label>角色</Label>
          <Input v-model="filters.role" placeholder="user / admin / root" />
        </div>
        <div class="space-y-2">
          <Label>开始日期</Label>
          <Input v-model="filters.start_time" type="date" />
        </div>
        <div class="space-y-2">
          <Label>结束日期</Label>
          <Input v-model="filters.end_time" type="date" />
        </div>
        <div class="md:col-span-4 flex flex-wrap gap-3">
          <Button :disabled="isLoading" @click="fetchUsers">{{ isLoading ? "查询中..." : "查询" }}</Button>
          <Button variant="outline" @click="resetFilters">重置</Button>
        </div>
      </CardContent>
    </Card>

    <p v-if="errorMessage" class="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ errorMessage }}
    </p>

    <Card class="rounded-3xl">
      <CardHeader>
        <CardTitle class="text-lg">用户列表</CardTitle>
        <CardDescription>共 {{ total }} 条数据。</CardDescription>
      </CardHeader>
      <CardContent class="space-y-3">
        <div
          v-for="user in users"
          :key="user.id"
          class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
        >
          <div>
            <p class="text-sm font-semibold text-slate-900">{{ user.username }}</p>
            <p class="text-xs text-slate-500">ID: {{ user.id }} · 角色: {{ user.role }}</p>
          </div>
          <div class="flex gap-2">
            <Button size="sm" variant="outline" @click="openEditDialog(user)">修改</Button>
            <Button size="sm" variant="destructive" :disabled="isDeleting === user.id" @click="handleDelete(user.id)">
              {{ isDeleting === user.id ? "删除中..." : "删除" }}
            </Button>
          </div>
        </div>
        <p v-if="!users.length && !isLoading" class="text-sm text-slate-500">暂无用户数据。</p>
      </CardContent>
    </Card>

    <div v-if="isDialogOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-6">
      <Card class="w-full max-w-md rounded-3xl">
        <CardHeader>
          <CardTitle class="text-xl">{{ isEditing ? "修改用户" : "新增用户" }}</CardTitle>
          <CardDescription>{{ isEditing ? "仅需填写要修改的字段。" : "填写用户名、角色与密码。" }}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="space-y-2">
            <Label>用户名</Label>
            <Input v-model="form.username" placeholder="请输入用户名" />
          </div>
          <div class="space-y-2">
            <Label>{{ isEditing ? "密码（可选）" : "密码" }}</Label>
            <Input v-model="form.password" type="password" :placeholder="isEditing ? '留空则不修改密码' : '请输入密码'" />
          </div>
          <div class="space-y-2">
            <Label>角色</Label>
            <Input v-model="form.role" placeholder="user / admin / root" />
          </div>
          <div class="flex flex-wrap gap-3">
            <Button :disabled="isSaving" @click="handleSave">{{ isSaving ? "保存中..." : "保存" }}</Button>
            <Button variant="outline" @click="closeDialog">取消</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
