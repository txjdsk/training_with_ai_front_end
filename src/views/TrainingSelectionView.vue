<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createSession, getPrompts, getPromptTypes } from "@/lib/api";

type PromptItem = { id: number; note: string; type: number };
type PromptTypeItem = { id: number; name: string };

const roleSearch = ref("");
const sceneSearch = ref("");
const roleOptions = ref<PromptItem[]>([]);
const sceneOptions = ref<PromptItem[]>([]);
const promptTypes = ref<PromptTypeItem[]>([]);
const selectedRoleId = ref<number | null>(null);
const selectedSceneId = ref<number | null>(null);
const sceneFilterTypeId = ref<number | null>(null);
const sceneTypeNameSearch = ref("");
const roleIdSortOrder = ref<"asc" | "desc">("asc");
const sceneSortKey = ref<"id" | "type">("id");
const sceneIdSortOrder = ref<"asc" | "desc">("asc");
const sceneCategoryIdSortOrder = ref<"asc" | "desc">("asc");
const difficulty = ref<string>("");
const currentStep = ref(0);
const isLoadingRoles = ref(false);
const isLoadingScenes = ref(false);
const isCreating = ref(false);
const errorMessage = ref("");
const sessionId = ref("");
const router = useRouter();

const difficultyOptions = [
  { label: "低", value: "low" },
  { label: "中", value: "normal" },
  { label: "高", value: "high" },
];
//已有同页流程、进度提示、完成后创建 session_id 并跳转到对话界面：见 训练信息选择页。但是目前只完成了“单页不刷新 + 完成后创建 session 并跳转对话页”。
//现已优化为向导式单页，完成一步自动切换下一步。
const steps = computed(() => [
  { title: "选择角色", description: "面对应对的顾客", done: selectedRoleId.value !== null },
  { title: "选择场景", description: "具体的业务场景", done: selectedSceneId.value !== null },
  { title: "选择难度", description: "初始怒气值", done: !!difficulty.value },
  { title: "确认并开始", description: "生成训练会话", done: canStart.value },
]);

const canStart = computed(() => !!selectedRoleId.value && !!selectedSceneId.value && !!difficulty.value);
const canGoPrev = computed(() => currentStep.value > 0);
const canGoNext = computed(() => {
  if (currentStep.value === 0) return selectedRoleId.value !== null;
  if (currentStep.value === 1) return selectedSceneId.value !== null;
  if (currentStep.value === 2) return !!difficulty.value;
  return canStart.value;
});

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

const sortedRoleOptions = computed(() => {
  const list = [...roleOptions.value];
  list.sort((a, b) => (roleIdSortOrder.value === "asc" ? a.id - b.id : b.id - a.id));
  return list;
});

const filteredSceneOptions = computed(() => {
  const keyword = sceneTypeNameSearch.value.trim().toLowerCase();
  return sceneOptions.value.filter((item) => {
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

const sortedSceneOptions = computed(() => {
  const list = [...filteredSceneOptions.value];
  if (sceneSortKey.value === "type") {
    list.sort((a, b) => (sceneCategoryIdSortOrder.value === "asc" ? a.type - b.type : b.type - a.type));
    return list;
  }
  list.sort((a, b) => (sceneIdSortOrder.value === "asc" ? a.id - b.id : b.id - a.id));
  return list;
});

async function loadPromptTypes() {
  try {
    promptTypes.value = await getPromptTypes();
  } catch {
    promptTypes.value = [];
  }
}

function toggleSceneIdSort() {
  sceneSortKey.value = "id";
  sceneIdSortOrder.value = sceneIdSortOrder.value === "asc" ? "desc" : "asc";
}

function toggleSceneCategoryIdSort() {
  sceneSortKey.value = "type";
  sceneCategoryIdSortOrder.value = sceneCategoryIdSortOrder.value === "asc" ? "desc" : "asc";
}

function toggleRoleIdSort() {
  roleIdSortOrder.value = roleIdSortOrder.value === "asc" ? "desc" : "asc";
}

function handleRoleSelect(id: number) {
  selectedRoleId.value = id;
  setTimeout(() => {
    if (currentStep.value === 0) currentStep.value = 1;
  }, 250);
}

function handleSceneSelect(id: number) {
  selectedSceneId.value = id;
  setTimeout(() => {
    if (currentStep.value === 1) currentStep.value = 2;
  }, 250);
}

function handleDifficultySelect(val: string) {
  difficulty.value = val;
  setTimeout(() => {
    if (currentStep.value === 2) currentStep.value = 3;
  }, 250);
}

function goToPrevStep() {
  if (currentStep.value > 0) {
    currentStep.value -= 1;
  }
}

function goToNextStep() {
  if (currentStep.value === 0 && selectedRoleId.value === null) {
    errorMessage.value = "请先选择角色。";
    return;
  }
  if (currentStep.value === 1 && selectedSceneId.value === null) {
    errorMessage.value = "请先选择场景。";
    return;
  }
  if (currentStep.value === 2 && !difficulty.value) {
    errorMessage.value = "请先选择难度。";
    return;
  }
  errorMessage.value = "";
  if (currentStep.value < 3) {
    currentStep.value += 1;
    return;
  }
  handleCreateSession();
}

async function loadRoles() {
  isLoadingRoles.value = true;
  errorMessage.value = "";
  try {
    roleOptions.value = await getPrompts({ type: 6, search: roleSearch.value.trim() || undefined });
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "角色列表加载失败。";
  } finally {
    isLoadingRoles.value = false;
  }
}

async function loadScenes() {
  isLoadingScenes.value = true;
  errorMessage.value = "";
  try {
    sceneOptions.value = await getPrompts({ type: 7, search: sceneSearch.value.trim() || undefined });
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "场景列表加载失败。";
  } finally {
    isLoadingScenes.value = false;
  }
}

async function handleCreateSession() {
  if (!canStart.value) {
    errorMessage.value = "请先完成角色、场景与难度选择。";
    return;
  }
  isCreating.value = true;
  errorMessage.value = "";
  try {
    const result = await createSession([selectedRoleId.value!, selectedSceneId.value!], difficulty.value);
    sessionId.value = result.session_id;
    await router.push(`/training/chat/${result.session_id}`);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "创建训练失败。";
  } finally {
    isCreating.value = false;
  }
}

onMounted(() => {
  loadPromptTypes();
  loadRoles();
  loadScenes();
});
</script>

<template>
  <div class="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-8 px-6 py-12">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-semibold text-slate-900">配置你的训练场景</h1>
        <p class="mt-2 text-sm text-slate-600">
          按步骤完成角色、场景与难度选择，系统将自动拼接提示词并创建训练会话。
        </p>
      </div>
      <Button variant="outline" @click="router.push('/training/history')">查看训练历史</Button>
    </header>

    <p v-if="errorMessage" class="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ errorMessage }}
    </p>

    <!-- 横向选项卡进度条 -->
    <div class="relative flex items-center justify-between px-4 pb-6">
      <!-- 背景连接线 -->
      <div class="absolute left-6 right-6 top-5 -z-10 h-[2px] bg-slate-100"></div>
      
      <template v-for="(step, index) in steps" :key="index">
        <div 
          class="flex flex-col items-center cursor-pointer group w-24" 
          @click="currentStep = index"
        >
          <div 
            class="flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors bg-white relative z-10"
            :class="[
              currentStep === index ? 'border-blue-600 bg-blue-600 text-white' : 
              step.done ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 bg-white text-slate-600 group-hover:border-slate-400'
            ]"
          >
            <span class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center text-sm font-semibold leading-none text-black">
              {{ index + 1 }}
            </span>
          </div>
          <div class="mt-3 text-center">
            <div class="text-sm font-semibold transition-colors" :class="currentStep === index ? 'text-blue-600' : (step.done ? 'text-slate-900' : 'text-slate-500')">
              {{ step.title }}
            </div>
            <div class="text-xs text-slate-400 mt-0.5 whitespace-nowrap">{{ step.description }}</div>
          </div>
        </div>
      </template>
    </div>

    <!-- 步骤内容区 -->
    <div class="w-full flex-1">
      <Card v-if="currentStep === 0" class="rounded-3xl shadow-sm">
        <CardHeader>
          <CardTitle class="text-lg">第一步：选择角色</CardTitle>
          <CardDescription>从下方列表中挑选你将要面对应对的顾客角色，点击行即可选择并进入下一步。</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="flex flex-wrap gap-2">
            <Input v-model="roleSearch" placeholder="搜索角色关键词" class="max-w-xs" />
            <Button variant="outline" :disabled="isLoadingRoles" @click="loadRoles">
              {{ isLoadingRoles ? "加载中..." : "查询" }}
            </Button>
          </div>
          <div class="rounded-xl border shadow-sm overflow-hidden">
            <Table>
              <TableHeader class="bg-slate-100/50">
                <TableRow>
                  <TableHead class="w-[80px] border-r px-4 text-center font-semibold text-slate-700">
                    <Button variant="ghost" size="sm" class="h-7 px-2 text-slate-700 hover:text-slate-900" @click="toggleRoleIdSort">
                      ID {{ roleIdSortOrder === "asc" ? "↑" : "↓" }}
                    </Button>
                  </TableHead>
                  <TableHead class="border-r px-4 font-semibold text-slate-700">角色名称 / 备注</TableHead>
                  <TableHead class="w-[120px] px-6 text-center font-semibold text-slate-700">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow 
                  v-for="(role, index) in sortedRoleOptions" 
                  :key="role.id"
                  class="hover:bg-slate-100/50 transition-colors cursor-pointer"
                  :class="[
                    index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50',
                    selectedRoleId === role.id ? 'bg-blue-50 hover:bg-blue-50/80' : ''
                  ]"
                  @click="handleRoleSelect(role.id)"
                >
                  <TableCell class="border-r px-4 text-center font-medium text-slate-900">{{ role.id }}</TableCell>
                  <TableCell class="border-r px-4 text-slate-700">{{ role.note || "未命名角色" }}</TableCell>
                  <TableCell class="px-6 text-center">
                    <Button
                      size="sm"
                      :variant="selectedRoleId === role.id ? 'default' : 'outline'"
                      @click.stop="handleRoleSelect(role.id)"
                    >
                      {{ selectedRoleId === role.id ? "已选择" : "待选" }}
                    </Button>
                  </TableCell>
                </TableRow>
                <TableRow v-if="!sortedRoleOptions.length && !isLoadingRoles">
                  <TableCell colspan="3" class="h-24 text-center text-slate-500">
                    暂无角色数据
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card v-if="currentStep === 1" class="rounded-3xl shadow-sm">
        <CardHeader>
          <CardTitle class="text-lg">第二步：选择场景</CardTitle>
          <CardDescription>选择需要训练应对的具体业务场景，挑选完毕将自动进入下一步。</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="flex flex-wrap gap-2 items-center">
            <Input v-model="sceneSearch" placeholder="搜索场景备注" class="max-w-xs" />
            <Button variant="outline" :disabled="isLoadingScenes" @click="loadScenes">
              {{ isLoadingScenes ? "加载中..." : "查询" }}
            </Button>
            <div class="flex items-center gap-1">
              <Input v-model="sceneFilterTypeIdInput" type="number" min="7" placeholder="分类ID筛选" class="w-36" />
              <Input v-model="sceneTypeNameSearch" placeholder="分类名称筛选" class="w-44" />
            </div>
          </div>
          <div class="rounded-xl border shadow-sm overflow-hidden">
            <Table>
              <TableHeader class="bg-slate-100/50">
                <TableRow>
                  <TableHead class="w-[80px] border-r px-4 text-center font-semibold text-slate-700">
                    <Button variant="ghost" size="sm" class="h-7 px-2 text-slate-700 hover:text-slate-900" @click="toggleSceneIdSort">
                      ID {{ sceneSortKey === "id" ? (sceneIdSortOrder === "asc" ? "↑" : "↓") : "" }}
                    </Button>
                  </TableHead>
                  <TableHead class="w-[120px] border-r px-4 text-center font-semibold text-slate-700">
                    <Button variant="ghost" size="sm" class="h-7 px-2 text-slate-700 hover:text-slate-900" @click="toggleSceneCategoryIdSort">
                      分类 ID {{ sceneSortKey === "type" ? (sceneCategoryIdSortOrder === "asc" ? "↑" : "↓") : "" }}
                    </Button>
                  </TableHead>
                  <TableHead class="w-[180px] border-r px-4 font-semibold text-slate-700">分类名称</TableHead>
                  <TableHead class="border-r px-4 font-semibold text-slate-700">场景名称 / 备注</TableHead>
                  <TableHead class="w-[120px] px-6 text-center font-semibold text-slate-700">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow 
                  v-for="(scene, index) in sortedSceneOptions" 
                  :key="scene.id"
                  class="hover:bg-slate-100/50 transition-colors cursor-pointer"
                  :class="[
                    index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50',
                    selectedSceneId === scene.id ? 'bg-blue-50 hover:bg-blue-50/80' : ''
                  ]"
                  @click="handleSceneSelect(scene.id)"
                >
                  <TableCell class="border-r px-4 text-center font-medium text-slate-900">{{ scene.id }}</TableCell>
                  <TableCell class="border-r px-4 text-center text-slate-700">{{ scene.type }}</TableCell>
                  <TableCell class="border-r px-4 text-slate-700">{{ promptTypeNameMap.get(scene.type) || '未配置分类名' }}</TableCell>
                  <TableCell class="border-r px-4 text-slate-700">{{ scene.note || "未命名场景" }}</TableCell>
                  <TableCell class="px-6 text-center">
                    <Button
                      size="sm"
                      :variant="selectedSceneId === scene.id ? 'default' : 'outline'"
                      @click.stop="handleSceneSelect(scene.id)"
                    >
                      {{ selectedSceneId === scene.id ? "已选择" : "待选" }}
                    </Button>
                  </TableCell>
                </TableRow>
                <TableRow v-if="!sortedSceneOptions.length && !isLoadingScenes">
                  <TableCell colspan="5" class="h-24 text-center text-slate-500">
                    暂无场景数据
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card v-if="currentStep === 2" class="rounded-3xl shadow-sm">
        <CardHeader>
          <CardTitle class="text-lg">第三步：选择难度</CardTitle>
          <CardDescription>难度决定初始的顾客怒气值状态。</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-4 md:grid-cols-3 pt-6 pb-12">
          <Button
            v-for="option in difficultyOptions"
            :key="option.value"
            :variant="difficulty === option.value ? 'default' : 'outline'"
            class="h-16 text-lg"
            @click="handleDifficultySelect(option.value)"
          >
            {{ option.label }}
          </Button>
        </CardContent>
      </Card>

      <Card v-if="currentStep === 3" class="rounded-3xl shadow-sm">
        <CardHeader>
          <CardTitle class="text-lg">第四步：确认信息</CardTitle>
          <CardDescription>确认下方已选配置，系统将为您生成专属训练对话。</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="rounded-xl bg-slate-50 p-6 border border-slate-100 flex flex-col gap-4">
            <div class="grid grid-cols-3 gap-6 text-sm">
              <div class="space-y-1">
                <span class="text-slate-500 block">选定角色 ID</span>
                <span class="font-medium text-slate-900 text-lg">{{ selectedRoleId ?? "-" }}</span>
              </div>
              <div class="space-y-1">
                <span class="text-slate-500 block">选定场景 ID</span>
                <span class="font-medium text-slate-900 text-lg">{{ selectedSceneId ?? "-" }}</span>
              </div>
              <div class="space-y-1">
                <span class="text-slate-500 block">训练难度</span>
                <span class="font-medium text-slate-900 text-lg">
                  {{ difficultyOptions.find((option) => option.value === difficulty)?.label ?? "-" }}
                </span>
              </div>
            </div>
            
            <div v-if="!canStart" class="text-amber-600 bg-amber-50 p-3 rounded-lg flex items-center justify-between">
              您还有未选择的选项，请通过顶部进度条返回补充。
            </div>
          </div>
          
          <div class="flex justify-end gap-3">
            <Button variant="outline" @click="currentStep = 0">重新选择</Button>
            <Button :disabled="isCreating || !canStart" class="px-8" @click="handleCreateSession">
              {{ isCreating ? "正在创建训练环境..." : "开始训练" }}
            </Button>
          </div>
          
          <div v-if="sessionId" class="mt-4 p-4 text-center rounded-lg bg-green-50 text-green-700 font-medium">
            ✅ 会话创建成功：等待跳转至对话界面...（ID: {{ sessionId }}）
          </div>
        </CardContent>
      </Card>

      <div class="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div class="flex items-center justify-between gap-3">
          <Button variant="outline" class="min-w-28" :disabled="!canGoPrev" @click="goToPrevStep">
            上一步
          </Button>
          <Button
            class="min-w-28"
            :disabled="!canGoNext || isCreating"
            @click="goToNextStep"
          >
            {{ currentStep === 3 ? (isCreating ? "正在创建..." : "开始训练") : "下一步" }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
