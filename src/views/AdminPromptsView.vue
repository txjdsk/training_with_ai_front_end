<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  createPrompt,
  deletePrompt,
  getPromptDetail,
  getPrompts,
  getPromptTypes,
  optimizePrompt,
  updatePrompt,
} from "@/lib/api";

type PromptListItem = { id: number; note: string; type: number };
type PromptTypeItem = { id: number; name: string };

type PromptDetail = {
  id: number | null;
  categoryId: number;
  note: string;
  content: string;
};

const search = ref("");
const isLoading = ref(false);
const errorMessage = ref("");
const prompts = ref<PromptListItem[]>([]);
const promptTypes = ref<PromptTypeItem[]>([]);
const selectedSection = ref<number>(6);
const selectedPromptId = ref<number | null>(null);
const sceneFilterTypeId = ref<number | null>(null);
const sceneTypeNameSearch = ref("");
const isSaving = ref(false);
const isDeleting = ref(false);
const isOptimizing = ref(false);
const requirement = ref("");
const originalContent = ref("");
const isSheetOpen = ref(false);
const isDiffMode = ref(false);
const idSortOrder = ref<"asc" | "desc">("asc");
const categoryIdSortOrder = ref<"asc" | "desc">("asc");
const sortKey = ref<"id" | "type">("id");

const sections = [
  { id: 0, label: "System Prompt" },
  { id: 1, label: "Few-shot 示例" },
  { id: 2, label: "Background" },
  { id: 6, label: "角色提示词" },
  { id: 7, label: "场景提示词" },
];

const detail = ref<PromptDetail>({
  id: null,
  categoryId: 6,
  note: "",
  content: "",
});

const isFixedSection = computed(() => [0, 1, 2].includes(selectedSection.value));
const isEditing = computed(() => detail.value.id !== null);
const activeCategoryId = computed(() => selectedSection.value);
const canOptimize = computed(() => detail.value.id !== null && requirement.value.trim().length > 0);
const promptTypeNameMap = computed(() => {
  const map = new Map<number, string>();
  promptTypes.value.forEach((item) => map.set(item.id, item.name));
  return map;
});
const sceneFilterTypeIdInput = computed({
  get: () => (sceneFilterTypeId.value === null ? "" : String(sceneFilterTypeId.value)),
  set: (value: string) => {
    if (!value.trim()) {
      sceneFilterTypeId.value = null;
      return;
    }
    const parsed = Number(value);
    sceneFilterTypeId.value = Number.isNaN(parsed) ? null : parsed;
  },
});
const filteredPrompts = computed(() => {
  if (selectedSection.value !== 7) {
    return prompts.value;
  }
  const keyword = sceneTypeNameSearch.value.trim().toLowerCase();
  return prompts.value.filter((item) => {
    if (sceneFilterTypeId.value !== null && item.type !== sceneFilterTypeId.value) {
      return false;
    }
    if (!keyword) {
      return true;
    }
    const typeName = (promptTypeNameMap.value.get(item.type) ?? "").toLowerCase();
    return typeName.includes(keyword);
  });
});
const sortedPrompts = computed(() => {
  const list = [...filteredPrompts.value];
  if (sortKey.value === "type") {
    list.sort((a, b) => (categoryIdSortOrder.value === "asc" ? a.type - b.type : b.type - a.type));
    return list;
  }
  list.sort((a, b) => (idSortOrder.value === "asc" ? a.id - b.id : b.id - a.id));
  return list;
});
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
  requirement.value = "";
  isDiffMode.value = false;
}

async function loadPrompts() {
  isLoading.value = true;
  errorMessage.value = "";
  try {
    const list = await getPrompts({
      type: selectedSection.value === 7 ? undefined : activeCategoryId.value,
      search: search.value.trim() || undefined,
    });
    prompts.value = selectedSection.value === 7 ? list.filter((item) => item.type >= 7) : list;
    
    if (isFixedSection.value) {
      const firstPrompt = sortedPrompts.value[0];
      if (firstPrompt && firstPrompt.id) {
        await selectPrompt(firstPrompt.id);
      } else {
        startCreate();
      }
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "提示词加载失败。";
  } finally {
    isLoading.value = false;
  }
}

async function loadPromptTypes() {
  try {
    promptTypes.value = await getPromptTypes();
  } catch {
    promptTypes.value = [];
  }
}

async function selectPrompt(id: number) {
  selectedPromptId.value = id;
  errorMessage.value = "";
  isDiffMode.value = false;
  try {
    const data = await getPromptDetail(id);
    detail.value = {
      id: data.id,
      categoryId: data.category_id,
      note: data.note ?? "",
      content: data.content ?? "",
    };
    originalContent.value = data.content ?? "";
    requirement.value = "";
    
    if (!isFixedSection.value) {
      isSheetOpen.value = true;
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "提示词详情加载失败。";
  }
}

function handleSectionChange(sectionId: number) {
  selectedSection.value = sectionId;
  selectedPromptId.value = null;
  isSheetOpen.value = false;
  sceneFilterTypeId.value = null;
  sceneTypeNameSearch.value = "";
  sortKey.value = "id";
  idSortOrder.value = "asc";
  categoryIdSortOrder.value = "asc";
  resetDetail();
  loadPrompts();
}

function toggleIdSort() {
  sortKey.value = "id";
  idSortOrder.value = idSortOrder.value === "asc" ? "desc" : "asc";
}

function toggleCategoryIdSort() {
  sortKey.value = "type";
  categoryIdSortOrder.value = categoryIdSortOrder.value === "asc" ? "desc" : "asc";
}

function startCreate() {
  selectedPromptId.value = null;
  resetDetail();
  if (!isFixedSection.value) {
    isSheetOpen.value = true;
  }
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
    isDiffMode.value = false;
    await loadPrompts();
    isSheetOpen.value = false;
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
    isSheetOpen.value = false;
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
    detail.value.content = result.optimized_content;
    isDiffMode.value = true;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "优化失败。";
  } finally {
    isOptimizing.value = false;
  }
}

function cancelOptimization() {
  detail.value.content = originalContent.value;
  isDiffMode.value = false;
  requirement.value = "";
}

onMounted(() => {
  loadPromptTypes();
  loadPrompts();
  resetDetail();
});
</script>

<template>
  <div class="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-8 px-6 py-12">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-semibold text-slate-900">提示词筛选与修改</h1>
        <p class="mt-2 text-sm text-slate-600">选择左侧提示词模块，筛选并编辑提示词。</p>
      </div>
      <div class="flex flex-wrap gap-2">
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
        </CardContent>
      </Card>

      <div class="space-y-6 min-w-0">
        <Card v-if="!isFixedSection" class="rounded-3xl">
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-4">
            <div class="space-y-1">
              <CardTitle class="text-lg">提示词列表</CardTitle>
              <CardDescription>按备注搜索并管理当前模块下的提示词。</CardDescription>
            </div>
            <Button @click="startCreate">新增提示词</Button>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="flex flex-wrap gap-2">
              <Input v-model="search" placeholder="搜索提示词备注" class="max-w-xs" />
              <Button variant="outline" :disabled="isLoading" @click="loadPrompts">
                {{ isLoading ? "加载中..." : "查询" }}
              </Button>
              <template v-if="selectedSection === 7">
                <div class="flex items-center gap-1">
                  <Input v-model="sceneFilterTypeIdInput" type="number" min="7" placeholder="分类ID筛选" class="w-36" />
                  <Input v-model="sceneTypeNameSearch" placeholder="分类名称筛选" class="w-44" />
                </div>
              </template>
            </div>
            <div class="rounded-xl border shadow-sm overflow-hidden">
              <Table>
                <TableHeader class="bg-slate-100/50">
                  <TableRow>
                    <TableHead class="w-[80px] border-r px-4 text-center font-semibold text-slate-700">
                      <Button variant="ghost" size="sm" class="h-7 px-2 text-slate-700 hover:text-slate-900" @click="toggleIdSort">
                        ID {{ sortKey === "id" ? (idSortOrder === "asc" ? "↑" : "↓") : "" }}
                      </Button>
                    </TableHead>
                    <TableHead v-if="selectedSection === 7" class="w-[120px] border-r px-4 font-semibold text-slate-700 text-center">
                      <Button variant="ghost" size="sm" class="h-7 px-2 text-slate-700 hover:text-slate-900" @click="toggleCategoryIdSort">
                        分类 ID {{ sortKey === "type" ? (categoryIdSortOrder === "asc" ? "↑" : "↓") : "" }}
                      </Button>
                    </TableHead>
                    <TableHead v-if="selectedSection === 7" class="w-[180px] border-r px-4 font-semibold text-slate-700">分类名称</TableHead>
                    <TableHead class="border-r px-4 font-semibold text-slate-700 w-[200px]">备注/名称</TableHead>
                    <TableHead class="border-r px-6 font-semibold text-slate-700 text-center w-[120px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow 
                    v-for="(prompt, index) in sortedPrompts" 
                    :key="prompt.id"
                    class="hover:bg-slate-100/50 transition-colors"
                    :class="index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'"
                  >
                    <TableCell class="border-r px-4 text-center font-medium text-slate-900">{{ prompt.id }}</TableCell>
                    <TableCell v-if="selectedSection === 7" class="border-r px-4 text-center text-slate-700">{{ prompt.type }}</TableCell>
                    <TableCell v-if="selectedSection === 7" class="border-r px-4 text-slate-700">{{ promptTypeNameMap.get(prompt.type) || '未配置分类名' }}</TableCell>
                    <TableCell class="border-r px-4 text-slate-700">{{ prompt.note || '未命名提示词' }}</TableCell>
                    <TableCell class="border-r px-6 text-center">
                      <Button variant="outline" size="sm" @click="selectPrompt(prompt.id)">
                        编辑 / 预览
                      </Button>
                    </TableCell>
                  </TableRow>
                  <TableRow v-if="!sortedPrompts.length && !isLoading">
                    <TableCell :colspan="selectedSection === 7 ? 5 : 3" class="h-24 text-center text-slate-500">
                      暂无提示词
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <!-- Only show in main view for fixed sections -->
        <Card v-if="isFixedSection" class="rounded-3xl">
          <CardHeader>
            <CardTitle class="text-lg">提示词编辑</CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <div v-if="!isFixedSection" class="space-y-2">
              <Label>分类 ID</Label>
              <Input v-model="categoryIdInput" type="number" placeholder="例如 6 或 7" />
            </div>
            <div class="space-y-2">
              <Label>备注</Label>
              <Input v-model="detail.note" placeholder="提示词备注" />
            </div>
            <div class="space-y-2">
              <Label>内容</Label>
              <div v-if="!isDiffMode">
                <textarea
                  v-model="detail.content"
                  rows="12"
                  class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  placeholder="请输入提示词内容"
                ></textarea>
              </div>
              <div v-else class="grid gap-3 md:grid-cols-2">
                <div class="space-y-2">
                  <p class="text-xs font-medium text-slate-500">原文</p>
                  <textarea
                    :value="originalContent"
                    rows="12"
                    readonly
                    class="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                  ></textarea>
                </div>
                <div class="space-y-2">
                  <p class="text-xs font-medium text-slate-900">AI 修改后 (可继续编辑)</p>
                  <textarea
                    v-model="detail.content"
                    rows="12"
                    class="w-full rounded-md border border-blue-200 bg-blue-50/30 px-3 py-2 text-sm text-slate-900 shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                  ></textarea>
                  <div class="flex justify-end">
                    <Button variant="secondary" size="sm" @click="cancelOptimization" class="border-slate-400 bg-slate-900 text-white shadow-sm hover:bg-slate-800">取消应用更改</Button>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex flex-wrap gap-3">
              <Button :disabled="isSaving" @click="handleSave">{{ isSaving ? "保存中..." : "保存" }}</Button>
              <Button variant="outline" @click="startCreate">清空</Button>
              <Button v-if="!isFixedSection" variant="destructive" :disabled="isDeleting || !detail.id" @click="handleDelete">
                {{ isDeleting ? "删除中..." : "删除" }}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card v-if="isFixedSection" class="rounded-3xl">
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
              {{ isOptimizing ? "优化中..." : "生成优化结果 (将直接覆盖现有内容)" }}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>

    <Sheet v-model:open="isSheetOpen">
      <SheetContent class="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader class="mb-6">
          <SheetTitle>{{ isEditing ? "修改现有提示词" : "新增当前模块提示词" }}</SheetTitle>
          <SheetDescription>在表单中完成提示词设定并保存。</SheetDescription>
        </SheetHeader>
        
        <div class="space-y-6">
          <div class="space-y-4">
            <div v-if="selectedSection === 7" class="space-y-2">
              <Label>分类 ID</Label>
              <Input v-model="categoryIdInput" type="number" placeholder="例如 7" />
            </div>
            <div class="space-y-2">
              <Label>备注</Label>
              <Input v-model="detail.note" placeholder="提示词备注" />
            </div>
            <div class="space-y-2">
              <Label>内容</Label>
              <div v-if="!isDiffMode">
                <textarea
                  v-model="detail.content"
                  rows="12"
                  class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  placeholder="请输入提示词内容"
                ></textarea>
              </div>
              <div v-else class="grid gap-3 md:grid-cols-2">
                <div class="space-y-2">
                  <p class="text-xs font-medium text-slate-500">原文</p>
                  <textarea
                    :value="originalContent"
                    rows="12"
                    readonly
                    class="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                  ></textarea>
                </div>
                <div class="space-y-2">
                  <p class="text-xs font-medium text-slate-900">AI 修改后 (可继续编辑)</p>
                  <textarea
                    v-model="detail.content"
                    rows="12"
                    class="w-full rounded-md border border-blue-200 bg-blue-50/30 px-3 py-2 text-sm text-slate-900 shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                  ></textarea>
                  <div class="flex justify-end">
                    <Button variant="secondary" size="sm" @click="cancelOptimization" class="border-slate-400 bg-slate-900 text-white shadow-sm hover:bg-slate-800">取消应用更改</Button>
                  </div>
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
          </div>

          <div class="space-y-4 rounded-xl bg-slate-50 p-4 border border-slate-100">
            <h4 class="text-sm font-semibold text-slate-900">AI 辅助优化</h4>
            <div class="space-y-2">
              <Label>优化诉求</Label>
              <textarea
                v-model="requirement"
                rows="3"
                class="w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                placeholder="例如：更简洁、更友好、强调情绪安抚"
              ></textarea>
            </div>
            <Button :disabled="!canOptimize || isOptimizing" @click="handleOptimize" class="w-full">
              {{ isOptimizing ? "优化中..." : "生成优化结果 (将直接覆盖现有内容)" }}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
