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
import { createSession, getPrompts } from "@/lib/api";

type PromptItem = { id: number; note: string; type: number };

const roleSearch = ref("");
const sceneSearch = ref("");
const roleOptions = ref<PromptItem[]>([]);
const sceneOptions = ref<PromptItem[]>([]);
const selectedRoleId = ref<number | null>(null);
const selectedSceneId = ref<number | null>(null);
const difficulty = ref<string>("normal");
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
//已有同页流程、进度提示、完成后创建 session_id 并跳转到对话界面：见 训练信息选择页。但是目前只完成了“单页不刷新 + 完成后创建 session 并跳转对话页”，但没有做到“逐步递进、每完成一项自动切换到下一步”的交互。
//TODO:进一步优化，步骤式单页（完成一步自动切换下一步，同时保留进度条）
const steps = computed(() => [
  { title: "选择角色", description: "category_id = 6", done: selectedRoleId.value !== null },
  { title: "选择场景", description: "category_id >= 7", done: selectedSceneId.value !== null },
  { title: "选择难度", description: "初始怒气值", done: !!difficulty.value },
  { title: "确认并开始", description: "生成 session_id", done: canStart.value },
]);

const canStart = computed(() => !!selectedRoleId.value && !!selectedSceneId.value && !!difficulty.value);

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
  loadRoles();
  loadScenes();
});
</script>

<template>
  <div class="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-8 px-6 py-12">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p class="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">训练信息选择</p>
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

    <div class="grid gap-6 lg:grid-cols-[1fr_2fr]">
      <Card class="rounded-3xl">
        <CardHeader>
          <CardTitle class="text-lg">选择进度</CardTitle>
          <CardDescription>当前为页面骨架，可按逻辑接入接口</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div v-for="(step, index) in steps" :key="step.title" class="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div class="flex items-center justify-between">
              <span class="text-sm font-semibold text-slate-900">{{ index + 1 }}. {{ step.title }}</span>
              <span class="text-xs text-slate-500">{{ step.description }}</span>
            </div>
            <div class="mt-2 h-1 w-full rounded-full bg-slate-100">
              <div
                class="h-1 rounded-full bg-slate-900"
                :class="step.done ? 'w-full' : 'w-1/3'"
              ></div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div class="space-y-6">
        <Card class="rounded-3xl">
          <CardHeader>
            <CardTitle class="text-lg">选择角色 (category_id = 6)</CardTitle>
            <CardDescription>从角色列表选择一个客服身份。</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="flex flex-wrap gap-2">
              <Input v-model="roleSearch" placeholder="搜索角色关键词" />
              <Button variant="outline" :disabled="isLoadingRoles" @click="loadRoles">
                {{ isLoadingRoles ? "加载中..." : "查询" }}
              </Button>
            </div>
            <div class="grid gap-3 md:grid-cols-2">
              <div
                v-for="role in roleOptions"
                :key="role.id"
                class="rounded-2xl border border-slate-200 bg-white px-4 py-3"
              >
                <p class="text-sm font-semibold text-slate-900">{{ role.note || "未命名角色" }}</p>
                <p class="text-xs text-slate-500">ID: {{ role.id }}</p>
                <Button
                  size="sm"
                  class="mt-3"
                  :variant="selectedRoleId === role.id ? 'default' : 'outline'"
                  @click="selectedRoleId = role.id"
                >
                  {{ selectedRoleId === role.id ? "已选择" : "选择" }}
                </Button>
              </div>
              <p v-if="!roleOptions.length" class="text-sm text-slate-500">暂无角色数据。</p>
            </div>
          </CardContent>
        </Card>

        <Card class="rounded-3xl">
          <CardHeader>
            <CardTitle class="text-lg">选择场景 (category_id >= 7)</CardTitle>
            <CardDescription>选择需要训练的业务场景。</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="flex flex-wrap gap-2">
              <Input v-model="sceneSearch" placeholder="搜索场景关键词" />
              <Button variant="outline" :disabled="isLoadingScenes" @click="loadScenes">
                {{ isLoadingScenes ? "加载中..." : "查询" }}
              </Button>
            </div>
            <div class="grid gap-3 md:grid-cols-2">
              <div
                v-for="scene in sceneOptions"
                :key="scene.id"
                class="rounded-2xl border border-slate-200 bg-white px-4 py-3"
              >
                <p class="text-sm font-semibold text-slate-900">{{ scene.note || "未命名场景" }}</p>
                <p class="text-xs text-slate-500">ID: {{ scene.id }}</p>
                <Button
                  size="sm"
                  class="mt-3"
                  :variant="selectedSceneId === scene.id ? 'default' : 'outline'"
                  @click="selectedSceneId = scene.id"
                >
                  {{ selectedSceneId === scene.id ? "已选择" : "选择" }}
                </Button>
              </div>
              <p v-if="!sceneOptions.length" class="text-sm text-slate-500">暂无场景数据。</p>
            </div>
          </CardContent>
        </Card>

        <Card class="rounded-3xl">
          <CardHeader>
            <CardTitle class="text-lg">选择难度</CardTitle>
            <CardDescription>难度决定初始怒气值。</CardDescription>
          </CardHeader>
          <CardContent class="grid gap-3 md:grid-cols-3">
            <Button
              v-for="option in difficultyOptions"
              :key="option.value"
              :variant="difficulty === option.value ? 'default' : 'outline'"
              @click="difficulty = option.value"
            >
              {{ option.label }}
            </Button>
          </CardContent>
        </Card>

        <Card class="rounded-3xl">
          <CardHeader>
            <CardTitle class="text-lg">确认信息</CardTitle>
            <CardDescription>确认选择后开始训练。</CardDescription>
          </CardHeader>
          <CardContent class="flex flex-wrap items-center justify-between gap-4">
            <div class="text-sm text-slate-600">
              已选：角色 ID {{ selectedRoleId ?? "-" }}，场景 ID {{ selectedSceneId ?? "-" }}，难度：{​{
                difficultyOptions.find((option) => option.value === difficulty)?.label ?? "-"
              }}
            </div>
            <Button :disabled="isCreating" @click="handleCreateSession">
              {{ isCreating ? "创建中..." : "开始训练" }}
            </Button>
          </CardContent>
          <CardContent v-if="sessionId" class="pt-0 text-sm text-slate-600">
            已创建训练会话：{{ sessionId }}（可接入训练对话界面）
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
