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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

const sortKey = ref<"id" | "created_at" | "role" | null>(null);
const sortDesc = ref(false);

function handleSort(key: "id" | "created_at" | "role") {
  if (sortKey.value === key) {
    if (sortDesc.value) {
      sortKey.value = null; // 恢复默认
      sortDesc.value = false;
    } else {
      sortDesc.value = true; // 降序
    }
  } else {
    sortKey.value = key;
    sortDesc.value = false; // 升序
  }
}

const displayedUsers = computed(() => {
  let list = [...users.value];
  if (sortKey.value) {
    list.sort((a, b) => {
      const order = sortDesc.value ? -1 : 1;
      if (sortKey.value === "id") {
        return (a.id - b.id) * order;
      } else if (sortKey.value === "role") {
        return a.role.localeCompare(b.role) * order;
      } else if (sortKey.value === "created_at") {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return (timeA - timeB) * order;
      }
      return 0;
    });
  }
  return list;
});

function formatDate(isoString: string) {
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

async function fetchUsers() {
  isLoading.value = true;
  errorMessage.value = "";
  try {
    const roleVal = filters.role === "all" ? undefined : filters.role || undefined;
    const result = await getUsers({
      username: filters.username || undefined,
      role: roleVal,
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
        <h1 class="text-3xl font-semibold text-slate-900">用户筛选与维护</h1>
        <p class="mt-2 text-sm text-slate-600">
          按用户名、角色与时间筛选用户，支持新增、修改与删除。
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
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
          <Select v-model="filters.role">
            <SelectTrigger>
              <SelectValue placeholder="选择角色" />
            </SelectTrigger>
            <SelectContent class="z-[100]">
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="user">普通用户 (user)</SelectItem>
              <SelectItem value="admin">管理员 (admin)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="space-y-2">
          <Label>最早注册日期</Label>
          <Input v-model="filters.start_time" type="date" />
        </div>
        <div class="space-y-2">
          <Label>最晚注册日期</Label>
          <Input v-model="filters.end_time" type="date" />
        </div>
        <div class="md:col-span-4 flex flex-wrap gap-3">
          <Button :disabled="isLoading" @click="fetchUsers">{{ isLoading ? "查询中..." : "查询" }}</Button>
          <Button variant="outline" @click="resetFilters">清除筛选</Button>
        </div>
      </CardContent>
    </Card>

    <p v-if="errorMessage" class="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ errorMessage }}
    </p>

    <Card class="rounded-3xl">
      <CardHeader>
        <CardTitle class="text-lg">用户列表</CardTitle>
        <CardDescription>共找到 {{ total }} 名用户。
          <Button @click="openCreateDialog" >新增用户</Button>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div class="rounded-xl border shadow-sm overflow-hidden">
          <Table>
            <TableHeader class="bg-slate-100/50">
              <TableRow>
                <TableHead
                  class="w-[120px] border-r px-4 text-center font-semibold text-slate-700 cursor-pointer select-none hover:bg-slate-200/50 transition-colors"
                  @click="handleSort('id')"
                >
                  ID <span class="text-xs text-slate-400 inline-block w-3">{{ sortKey === 'id' ? (sortDesc ? '↓' : '↑') : '' }}</span>
                </TableHead>
                <TableHead class="border-r px-6 font-semibold text-slate-700">用户名</TableHead>
                <TableHead
                  class="border-r px-6 font-semibold text-slate-700 text-center w-[160px] cursor-pointer select-none hover:bg-slate-200/50 transition-colors"
                  @click="handleSort('role')"
                >
                  角色 <span class="text-xs text-slate-400 inline-block w-3">{{ sortKey === 'role' ? (sortDesc ? '↓' : '↑') : '' }}</span>
                </TableHead>
                <TableHead
                  class="border-r px-6 font-semibold text-slate-700 text-center w-[200px] cursor-pointer select-none hover:bg-slate-200/50 transition-colors"
                  @click="handleSort('created_at')"
                >
                  注册时间 <span class="text-xs text-slate-400 inline-block w-3">{{ sortKey === 'created_at' ? (sortDesc ? '↓' : '↑') : '' }}</span>
                </TableHead>
                <TableHead class="w-[160px] px-4 text-center font-semibold text-slate-700">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="(user, index) in displayedUsers"
                :key="user.id"
                class="hover:bg-slate-100/50 transition-colors"
                :class="index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'"
              >
                <TableCell class="border-r px-4 text-center font-medium text-slate-900">{{ user.id }}</TableCell>
                <TableCell class="border-r px-6 text-slate-700">{{ user.username }}</TableCell>
                <TableCell class="border-r px-6 text-center">
                   <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                         :class="user.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'">
                     {{ user.role === 'admin' ? '管理员' : '普通用户' }}
                   </span>
                </TableCell>
                <TableCell class="border-r px-6 text-center text-slate-500 text-sm">
                  {{ formatDate(user.created_at) }}
                </TableCell>
                <TableCell class="px-4">
                  <div class="flex justify-center gap-2">
                    <Button size="sm" variant="outline" @click="openEditDialog(user)">修改</Button>
                    <Button size="sm" variant="destructive" :disabled="isDeleting === user.id" @click="handleDelete(user.id)">
                      {{ isDeleting === user.id ? "删除中..." : "删除" }}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              <TableRow v-if="!users.length && !isLoading">
                <TableCell colspan="4" class="h-32 text-center text-sm text-slate-500 bg-slate-50/50">
                  暂无用户数据
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
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
            <Select v-model="form.role">
              <SelectTrigger>
                <SelectValue placeholder="选择角色" />
              </SelectTrigger>
              <SelectContent class="z-[100]">
                <SelectItem value="user">普通用户 (user)</SelectItem>
                <SelectItem value="admin">管理员 (admin)</SelectItem>
              </SelectContent>
            </Select>
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
