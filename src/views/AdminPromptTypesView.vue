<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPromptType, deletePromptType, getPromptTypes, updatePromptType } from "@/lib/api";

type PromptType = {
  id: number;
  name: string;
};

const router = useRouter();
const types = ref<PromptType[]>([]);
const isLoading = ref(false);
const errorMessage = ref("");
const newId = ref("");
const newName = ref("");
const editingId = ref<number | null>(null);
const editingName = ref("");
const isSaving = ref(false);
const isDeleting = ref<number | null>(null);

async function loadTypes() {
  isLoading.value = true;
  errorMessage.value = "";
  try {
    types.value = await getPromptTypes();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "提示词类别加载失败。";
  } finally {
    isLoading.value = false;
  }
}

function startEdit(item: PromptType) {
  if (item.id < 7) {
    errorMessage.value = "固定类别不允许修改。";
    return;
  }
  editingId.value = item.id;
  editingName.value = item.name;
}

function cancelEdit() {
  editingId.value = null;
  editingName.value = "";
}

async function handleCreate() {
  const parsedId = Number(newId.value);
  if (!Number.isInteger(parsedId)) {
    errorMessage.value = "请输入有效的类别 ID。";
    return;
  }
  if (parsedId < 7) {
    errorMessage.value = "新增类别 ID 必须 >= 7。";
    return;
  }
  if (!newName.value.trim()) {
    errorMessage.value = "请输入类别名称。";
    return;
  }
  isSaving.value = true;
  errorMessage.value = "";
  try {
    await createPromptType({ id: parsedId, name: newName.value.trim() });
    newId.value = "";
    newName.value = "";
    await loadTypes();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "新增失败。";
  } finally {
    isSaving.value = false;
  }
}

async function handleUpdate() {
  if (!editingId.value) {
    return;
  }
  if (!editingName.value.trim()) {
    errorMessage.value = "请输入类别名称。";
    return;
  }
  isSaving.value = true;
  errorMessage.value = "";
  try {
    await updatePromptType(editingId.value, editingName.value.trim());
    cancelEdit();
    await loadTypes();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "更新失败。";
  } finally {
    isSaving.value = false;
  }
}

async function handleDelete(id: number) {
  if (id < 7) {
    errorMessage.value = "固定类别不允许删除。";
    return;
  }
  if (!confirm("确定要删除该类别吗？")) {
    return;
  }
  isDeleting.value = id;
  errorMessage.value = "";
  try {
    await deletePromptType(id);
    await loadTypes();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "删除失败。";
  } finally {
    isDeleting.value = null;
  }
}

onMounted(() => {
  loadTypes();
});
</script>

<template>
  <div class="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-8 px-6 py-12">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p class="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">提示词类别</p>
        <h1 class="text-3xl font-semibold text-slate-900">类别管理</h1>
        <p class="mt-2 text-sm text-slate-600">新增、修改、删除提示词类别。</p>
      </div>
      <Button variant="outline" @click="router.push('/admin/prompts')">返回提示词管理</Button>
    </header>

    <p v-if="errorMessage" class="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ errorMessage }}
    </p>

    <Card class="rounded-3xl">
      <CardHeader>
        <CardTitle class="text-lg">新增类别</CardTitle>
        <CardDescription>新增类别需自定义 ID，且必须 >= 7。</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-wrap items-end gap-3">
        <div class="w-32 space-y-2">
          <Label>类别 ID</Label>
          <Input v-model="newId" type="number" min="7" placeholder=">= 7" />
        </div>
        <div class="flex-1 space-y-2">
          <Label>类别名称</Label>
          <Input v-model="newName" placeholder="请输入类别名称" />
        </div>
        <Button :disabled="isSaving" @click="handleCreate">{{ isSaving ? "保存中..." : "新增" }}</Button>
      </CardContent>
    </Card>

    <Card class="rounded-3xl">
      <CardHeader>
        <CardTitle class="text-lg">类别列表</CardTitle>
        <CardDescription>共 {{ types.length }} 条记录。</CardDescription>
      </CardHeader>
      <CardContent class="space-y-3">
        <div
          v-for="item in types"
          :key="item.id"
          class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
        >
          <div class="flex-1">
            <p class="text-sm font-semibold text-slate-900">ID: {{ item.id }}</p>
            <p class="text-xs text-slate-500">名称：{{ item.name }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" :disabled="item.id < 7" @click="startEdit(item)">修改</Button>
            <Button size="sm" variant="destructive" :disabled="item.id < 7 || isDeleting === item.id" @click="handleDelete(item.id)">
              {{ isDeleting === item.id ? "删除中..." : "删除" }}
            </Button>
          </div>
        </div>
        <p v-if="!types.length && !isLoading" class="text-sm text-slate-500">暂无类别。</p>
      </CardContent>
    </Card>

    <div v-if="editingId" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-6">
      <Card class="w-full max-w-md rounded-3xl">
        <CardHeader>
          <CardTitle class="text-xl">修改类别</CardTitle>
          <CardDescription>更新类别名称。</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="space-y-2">
            <Label>类别名称</Label>
            <Input v-model="editingName" placeholder="请输入类别名称" />
          </div>
          <div class="flex flex-wrap gap-3">
            <Button :disabled="isSaving" @click="handleUpdate">{{ isSaving ? "保存中..." : "保存" }}</Button>
            <Button variant="outline" @click="cancelEdit">取消</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
