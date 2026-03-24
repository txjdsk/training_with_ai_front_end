<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createPrompt,
  deletePrompt,
  getPromptDetail,
  getPrompts,
  optimizePrompt,
  updatePrompt,
} from "@/lib/api";

type PromptListItem = { id: number; note: string; type: number };

type PromptDetail = {
  id: number | null;
  categoryId: number;
  note: string;
  content: string;
};

const router = useRouter();
const search = ref("");
const isLoading = ref(false);
const errorMessage = ref("");
const prompts = ref<PromptListItem[]>([]);
const selectedSection = ref<number>(6);
const selectedPromptId = ref<number | null>(null);
const sceneCategoryId = ref<number>(7);
const isSaving = ref(false);
const isDeleting = ref(false);
const isOptimizing = ref(false);
const requirement = ref("");
const optimizedContent = ref("");
const originalContent = ref("");
const previewOpen = ref(false);

const sections = [
  { id: 0, label: "System Prompt" },
  { id: 1, label: "Few-shot 示例" },
  { id: 2, label: "Background" },
  { id: 6, label: "角色档案" },
  { id: 7, label: "场景提示词 (7+)" },
];

const detail = ref<PromptDetail>({
  id: null,
  categoryId: 6,
  note: "",
  content: "",
});

const isEditing = computed(() => detail.value.id !== null);
const activeCategoryId = computed(() => (selectedSection.value === 7 ? sceneCategoryId.value : selectedSection.value));
const canOptimize = computed(() => detail.value.id !== null && requirement.value.trim().length > 0);
const categoryIdInput = computed({
  get: () => String(detail.value.categoryId ?? ""),
  set: (value: string) => {
    const parsed = Number(value);
    detail.value.categoryId = Number.isNaN(parsed) ? 0 : parsed;
  },
});

function resetDetail() {
  detail.value = {
    id: null,
    categoryId: activeCategoryId.value,
    note: "",
    content: "",
  };
  originalContent.value = "";
  optimizedContent.value = "";
  requirement.value = "";
}

async function loadPrompts() {
  isLoading.value = true;
  errorMessage.value = "";
  try {
    prompts.value = await getPrompts({
      type: activeCategoryId.value,
      search: search.value.trim() || undefined,
    });
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "提示词加载失败。";
  } finally {
    isLoading.value = false;
  }
}

async function selectPrompt(id: number) {
  selectedPromptId.value = id;
  errorMessage.value = "";
  try {
    const data = await getPromptDetail(id);
    detail.value = {
      id: data.id,
      categoryId: data.category_id,
      note: data.note ?? "",
      content: data.content ?? "",
    };
    originalContent.value = data.content ?? "";
    optimizedContent.value = "";
    requirement.value = "";
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "提示词详情加载失败。";
  }
}

function handleSectionChange(sectionId: number) {
  selectedSection.value = sectionId;
  selectedPromptId.value = null;
  resetDetail();
  loadPrompts();
}

function startCreate() {
  selectedPromptId.value = null;
  resetDetail();
}

async function handleSave() {
  if (!detail.value.note.trim() || !detail.value.content.trim()) {
    errorMessage.value = "请填写提示词备注与内容。";
    return;
  }
  isSaving.value = true;
  errorMessage.value = "";
  try {
    if (detail.value.id) {
      await updatePrompt(detail.value.id, {
        category_id: detail.value.categoryId,
        note: detail.value.note.trim(),
        content: detail.value.content.trim(),
      });
    } else {
      const created = await createPrompt({
        category_id: detail.value.categoryId,
        note: detail.value.note.trim(),
        content: detail.value.content.trim(),
      });
      detail.value.id = created.id;
      selectedPromptId.value = created.id;
    }
    originalContent.value = detail.value.content.trim();
    optimizedContent.value = "";
    await loadPrompts();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "保存失败。";
  } finally {
    isSaving.value = false;
  }
}

async function handleDelete() {
  if (!detail.value.id) {
    return;
  }
  if (!confirm("确定要删除该提示词吗？")) {
    return;
  }
  isDeleting.value = true;
  errorMessage.value = "";
  try {
    await deletePrompt(detail.value.id);
    selectedPromptId.value = null;
    resetDetail();
    await loadPrompts();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "删除失败。";
  } finally {
    isDeleting.value = false;
  }
}

async function handleOptimize() {
  if (!detail.value.id) {
    return;
  }
  if (!requirement.value.trim()) {
    errorMessage.value = "请输入优化诉求。";
    return;
  }
  isOptimizing.value = true;
  errorMessage.value = "";
  try {
    const result = await optimizePrompt(detail.value.id, requirement.value.trim());
    optimizedContent.value = result.optimized_content;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "优化失败。";
  } finally {
    isOptimizing.value = false;
  }
}

function applyOptimized() {
  if (!optimizedContent.value) {
    return;
  }
  detail.value.content = optimizedContent.value;
}

onMounted(() => {
  loadPrompts();
  resetDetail();
});
</script>

<template>
  <div class="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-8 px-6 py-12">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p class="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">提示词管理</p>
        <h1 class="text-3xl font-semibold text-slate-900">提示词筛选与修改</h1>
        <p class="mt-2 text-sm text-slate-600">选择左侧提示词模块，筛选并编辑提示词。</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" @click="router.push('/admin/prompt-types')">提示词类别管理</Button>
        <Button variant="outline" @click="router.push('/admin/users')">返回用户管理</Button>
      </div>
    </header>

    <p v-if="errorMessage" class="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ errorMessage }}
    </p>

    <div class="grid gap-6 lg:grid-cols-[260px_1fr]">
      <Card class="rounded-3xl">
        <CardHeader>
          <CardTitle class="text-lg">模块切换</CardTitle>
          <CardDescription>点击切换提示词模块</CardDescription>
        </CardHeader>
        <CardContent class="space-y-2">
          <Button
            v-for="section in sections"
            :key="section.id"
            class="w-full justify-start"
            :variant="selectedSection === section.id ? 'default' : 'outline'"
            @click="handleSectionChange(section.id)"
          >
            {{ section.label }}
          </Button>
          <div v-if="selectedSection === 7" class="space-y-2 rounded-2xl border border-slate-200 bg-white px-3 py-3">
            <Label>场景分类 ID (>=7)</Label>
            <Input v-model.number="sceneCategoryId" type="number" min="7" placeholder="例如 7、8、9" @change="loadPrompts" />
          </div>
          <Button variant="ghost" class="w-full justify-start" @click="previewOpen = true">提示词预览</Button>
        </CardContent>
      </Card>

      <div class="space-y-6">
        <Card class="rounded-3xl">
          <CardHeader>
            <CardTitle class="text-lg">提示词列表</CardTitle>
            <CardDescription>按备注搜索并选择要修改的提示词。</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="flex flex-wrap gap-2">
              <Input v-model="search" placeholder="搜索提示词备注" />
              <Button variant="outline" :disabled="isLoading" @click="loadPrompts">
                {{ isLoading ? "加载中..." : "查询" }}
              </Button>
              <Button @click="startCreate">新增提示词</Button>
            </div>
            <div class="grid gap-3 md:grid-cols-2">
              <button
                v-for="prompt in prompts"
                :key="prompt.id"
                type="button"
                class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left"
                :class="selectedPromptId === prompt.id ? 'border-slate-900' : ''"
                @click="selectPrompt(prompt.id)"
              >
                <p class="text-sm font-semibold text-slate-900">{{ prompt.note || '未命名提示词' }}</p>
                <p class="text-xs text-slate-500">ID: {{ prompt.id }} · 分类: {{ prompt.type }}</p>
              </button>
              <p v-if="!prompts.length && !isLoading" class="text-sm text-slate-500">暂无提示词。</p>
            </div>
          </CardContent>
        </Card>

        <Card class="rounded-3xl">
          <CardHeader>
            <CardTitle class="text-lg">提示词编辑</CardTitle>
            <CardDescription>{{ isEditing ? "修改现有提示词" : "创建新提示词" }}</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="space-y-2">
              <Label>分类 ID</Label>
              <Input v-model="categoryIdInput" type="number" placeholder="例如 6 或 7" />
            </div>
            <div class="space-y-2">
              <Label>备注</Label>
              <Input v-model="detail.note" placeholder="提示词备注" />
            </div>
            <div class="space-y-2">
              <Label>内容</Label>
              <textarea
                v-model="detail.content"
                rows="6"
                class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                placeholder="请输入提示词内容"
              ></textarea>
            </div>
            <div v-if="optimizedContent" class="space-y-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <Label>原文 / 优化后对比</Label>
                <Button size="sm" variant="outline" @click="applyOptimized">应用优化结果</Button>
              </div>
              <div class="grid gap-3 md:grid-cols-2">
                <div class="space-y-2">
                  <p class="text-xs text-slate-500">原文</p>
                  <textarea
                    :value="originalContent"
                    rows="6"
                    readonly
                    class="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                  ></textarea>
                </div>
                <div class="space-y-2">
                  <p class="text-xs text-slate-500">优化后</p>
                  <textarea
                    :value="optimizedContent"
                    rows="6"
                    readonly
                    class="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  ></textarea>
                </div>
              </div>
            </div>
            <div class="flex flex-wrap gap-3">
              <Button :disabled="isSaving" @click="handleSave">{{ isSaving ? "保存中..." : "保存" }}</Button>
              <Button variant="outline" @click="startCreate">清空</Button>
              <Button variant="destructive" :disabled="isDeleting || !detail.id" @click="handleDelete">
                {{ isDeleting ? "删除中..." : "删除" }}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card class="rounded-3xl">
          <CardHeader>
            <CardTitle class="text-lg">AI 辅助优化</CardTitle>
            <CardDescription>输入优化诉求，生成优化后的提示词。</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="space-y-2">
              <Label>优化诉求</Label>
              <textarea
                v-model="requirement"
                rows="3"
                class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                placeholder="例如：更简洁、更友好、强调情绪安抚"
              ></textarea>
            </div>
            <Button :disabled="!canOptimize || isOptimizing" @click="handleOptimize">
              {{ isOptimizing ? "优化中..." : "生成优化结果" }}
            </Button>
            <div v-if="optimizedContent" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              已应用优化结果。
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    <div v-if="previewOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-6">
      <Card class="w-full max-w-2xl rounded-3xl">
        <CardHeader>
          <CardTitle class="text-xl">提示词预览</CardTitle>
          <CardDescription>此功能为预览占位，可在后续接入完整流程。</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            {{ detail.content || "暂无内容" }}
          </div>
          <div class="flex flex-wrap gap-3">
            <Button variant="outline" @click="previewOpen = false">关闭</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
