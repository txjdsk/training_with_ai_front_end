<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createPromptType, deletePromptType, getPromptTypes, updatePromptType } from "@/lib/api";

type PromptType = {
  id: number;
  name: string;
};

const types = ref<PromptType[]>([]);
const filteredTypes = computed(() => types.value.filter(t => t.id > 6));

const isLoading = ref(false);
const errorMessage = ref("");
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
    errorMessage.value = error instanceof Error ? error.message : "场景类别加载失败。";
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
  if (!newName.value.trim()) {
    errorMessage.value = "请输入类别名称。";
    return;
  }
  isSaving.value = true;
  errorMessage.value = "";
  try {
    await createPromptType({ name: newName.value.trim() });
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
        <h1 class="text-3xl font-semibold text-slate-900">场景类别管理</h1>
        <p class="mt-2 text-sm text-slate-600">新增、修改、删除场景类别。</p>
      </div>
    </header>

    <p v-if="errorMessage" class="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ errorMessage }}
    </p>

    <Card class="rounded-3xl">
      <CardHeader>
        <CardTitle class="text-lg">新增类别</CardTitle>
        <CardDescription>输入类别名称即可新增，ID 由系统自动生成。</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-wrap items-end gap-3">
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
        <CardDescription>共 {{ filteredTypes.length }} 条记录。</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="rounded-xl border shadow-sm overflow-hidden">
          <Table>
            <TableHeader class="bg-slate-100/50">
              <TableRow>
                <TableHead class="w-[120px] border-r px-4 text-center font-semibold text-slate-700">类别 ID</TableHead>
                <TableHead class="border-r px-6 font-semibold text-slate-700">类别名称</TableHead>
                <TableHead class="w-[160px] px-4 text-center font-semibold text-slate-700">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="(item, index) in filteredTypes"
                :key="item.id"
                class="hover:bg-slate-100/50 transition-colors"
                :class="index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'"
              >
                <TableCell class="border-r px-4 text-center font-medium text-slate-900">{{ item.id }}</TableCell>
                <TableCell class="border-r px-6 text-slate-700">{{ item.name }}</TableCell>
                <TableCell class="px-4">
                  <div class="flex justify-center gap-2">
                    <Button size="sm" variant="outline" @click="startEdit(item)">修改</Button>
                    <Button size="sm" variant="destructive" :disabled="isDeleting === item.id" @click="handleDelete(item.id)">
                      {{ isDeleting === item.id ? "删除中..." : "删除" }}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              <TableRow v-if="!filteredTypes.length && !isLoading">
                <TableCell colspan="3" class="h-32 text-center text-sm text-slate-500 bg-slate-50/50">
                  暂无类别数据
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
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
