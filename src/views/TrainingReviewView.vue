<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getProfile, getSessionDetail } from "@/lib/api";

type DialogueItem = {
  round: number;
  user_msg: string;
  customer_msg: string;
  customer_sentiment: string;
  anger_before: number;
  anger_delta: number;
  anger_after: number;
  expert_critique: string;
  polish_reply: string;
  reference_answer: string;
};

const route = useRoute();
const router = useRouter();
const sessionId = computed(() => String(route.params.id || ""));

const score = ref<number | null>(null);
const finishedAt = ref<string | null>(null);
const duration = ref<number | null>(null);
const promptsNotes = ref<string[]>([]);
const usedPromptIds = ref<number[]>([]);
const username = ref<string | null>(null);
const dialogue = ref<DialogueItem[]>([]);
const isAdmin = ref(false);
const errorMessage = ref("");
const isLoading = ref(false);

async function loadDetail() {
  if (!sessionId.value) {
    errorMessage.value = "缺少训练记录编号。";
    return;
  }
  isLoading.value = true;
  errorMessage.value = "";
  try {
    const [profile, result] = await Promise.all([
      getProfile().catch(() => null),
      getSessionDetail(sessionId.value),
    ]);
    if (profile?.role) {
      const normalized = profile.role.toLowerCase();
      isAdmin.value = normalized.includes("admin") || normalized.includes("root") || normalized.includes("manager");
    }
    score.value = result.score ?? null;
    finishedAt.value = result.finished_at ?? null;
    duration.value = result.duration ?? null;
    promptsNotes.value = result.prompts_notes ?? [];
    usedPromptIds.value = result.used_prompt_ids ?? [];
    username.value = result.username ?? null;
    dialogue.value = result.dialogue_log ?? [];
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "训练记录加载失败。";
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  loadDetail();
});
</script>

<template>
  <div class="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-8 px-6 py-10">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p class="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">训练复盘</p>
        <h1 class="text-3xl font-semibold text-slate-900">训练记录详情</h1>
        <p class="mt-2 text-sm text-slate-600">记录编号：{{ sessionId }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button @click="router.push('/training/history')">返回列表</Button>
      </div>
    </header>

    <p v-if="errorMessage" class="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ errorMessage }}
    </p>

    <Card class="rounded-3xl">
      <CardHeader>
        <CardTitle class="text-lg">成绩概览</CardTitle>
        <CardDescription>训练评分与摘要</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 md:grid-cols-4">
        <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p class="text-xs text-slate-500">评分</p>
          <p class="text-2xl font-semibold text-slate-900">{{ score ?? "-" }}</p>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p class="text-xs text-slate-500">完成时间</p>
          <p class="text-sm font-semibold text-slate-900">{{ finishedAt ?? "-" }}</p>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p class="text-xs text-slate-500">时长</p>
          <p class="text-sm font-semibold text-slate-900">{{ duration ?? "-" }} 秒</p>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p class="text-xs text-slate-500">用户</p>
          <p class="text-sm font-semibold text-slate-900">{{ username ?? "-" }}</p>
        </div>
      </CardContent>
      <CardContent class="pt-0 space-y-2">
        <div v-if="promptsNotes.length" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          提示词备注：{{ promptsNotes.join(" / ") }}
        </div>
        <div v-if="isAdmin && usedPromptIds.length" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          提示词编号：{{ usedPromptIds.join(", ") }}
        </div>
      </CardContent>
    </Card>

    <Card class="rounded-3xl">
      <CardHeader>
        <CardTitle class="text-lg">对话复盘</CardTitle>
        <CardDescription>逐轮查看客服回答、顾客反应与专家点评。</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div v-if="isLoading" class="text-sm text-slate-500">加载中...</div>
        <div v-for="item in dialogue" :key="item.round" class="rounded-3xl border border-slate-200 bg-white px-4 py-4">
          <div class="flex items-center justify-between">
            <p class="text-sm font-semibold text-slate-900">第 {{ item.round }} 轮</p>
            <span class="text-xs text-slate-500">情感：{{ item.customer_sentiment }}</span>
          </div>
          <div class="mt-3 grid gap-3 md:grid-cols-2">
            <div class="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
              <p class="text-xs text-slate-500">客服应答</p>
              <p class="text-sm text-slate-900">{{ item.user_msg }}</p>
            </div>
            <div class="rounded-2xl border border-slate-100 bg-white px-3 py-2">
              <p class="text-xs text-slate-500">顾客回复</p>
              <p class="text-sm text-slate-900">{{ item.customer_msg }}</p>
            </div>
          </div>
          <div class="mt-3 grid gap-3 md:grid-cols-3">
            <div class="rounded-2xl border border-slate-100 bg-white px-3 py-2">
              <p class="text-xs text-slate-500">专家点评</p>
              <p class="text-sm text-slate-900">{{ item.expert_critique }}</p>
            </div>
            <div class="rounded-2xl border border-slate-100 bg-white px-3 py-2">
              <p class="text-xs text-slate-500">斧正回复</p>
              <p class="text-sm text-slate-900">{{ item.polish_reply }}</p>
            </div>
            <div class="rounded-2xl border border-slate-100 bg-white px-3 py-2">
              <p class="text-xs text-slate-500">参考答案</p>
              <p class="text-sm text-slate-900">{{ item.reference_answer }}</p>
            </div>
          </div>
          <div class="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>怒气值：{{ item.anger_before }} → {{ item.anger_after }} ({{ item.anger_delta >= 0 ? '+' : '' }}{{ item.anger_delta }})</span>
          </div>
        </div>
        <p v-if="!dialogue.length && !isLoading" class="text-sm text-slate-500">暂无对话记录。</p>
      </CardContent>
    </Card>
  </div>
</template>
