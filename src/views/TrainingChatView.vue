<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSseClient } from "@/lib/sse";
import { getProfile, getSessionDetail, sendChatMessage, terminateSession } from "@/lib/api";

type ChatMessage = {
  id: string;
  role: "user" | "customer" | "system";
  content: string;
  sentiment?: string;
  critique?: string;
  reference?: string;
};

type SsePayload = {
  customer_msg?: string;
  current_anger?: number;
  max_anger?: number;
  turn_count?: number;
  status?: string;
};

const route = useRoute();
const router = useRouter();
const sessionId = computed(() => String(route.params.id || ""));

const messages = ref<ChatMessage[]>([]);
const inputText = ref("");
const isSending = ref(false);
const isTerminating = ref(false);
const errorMessage = ref("");

const currentAnger = ref<number | null>(null);
const maxAnger = ref<number | null>(null);
const turnCount = ref<number | null>(null);
const status = ref<string>("ongoing");
const hasNavigated = ref(false);
const showEndModal = ref(false);
const endScore = ref<number | null>(null);
const endSummary = ref<string | null>(null);
const endReference = ref<string | null>(null);
const endPromptsNotes = ref<string[]>([]);
const endPromptIds = ref<number[]>([]);
const isAdmin = ref(false);

const canSend = computed(() => !!inputText.value.trim() && !isSending.value);

let sseClient: { close: () => void } | null = null;

function pushMessage(role: ChatMessage["role"], content: string, detail?: Partial<ChatMessage>) {
  messages.value.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    sentiment: detail?.sentiment,
    critique: detail?.critique,
    reference: detail?.reference,
  });
}

function updateStateFromPayload(payload: SsePayload) {
  if (typeof payload.current_anger === "number") {
    currentAnger.value = payload.current_anger;
  }
  if (typeof payload.max_anger === "number") {
    maxAnger.value = payload.max_anger;
  }
  if (typeof payload.turn_count === "number") {
    turnCount.value = payload.turn_count;
  }
  if (payload.status) {
    status.value = payload.status;
    handleStatusRedirect(payload.status);
  }
}

async function handleStatusRedirect(nextStatus: string) {
  if (hasNavigated.value) {
    return;
  }
  if (nextStatus === "terminated") {
    hasNavigated.value = true;
    router.push({ path: "/training/terminated", query: { reason: "manual", id: sessionId.value } });
    return;
  }
  if (nextStatus === "success" || nextStatus === "failed" || nextStatus === "timeout") {
    hasNavigated.value = true;
    await loadEndSummary();
    showEndModal.value = true;
  }
}

async function loadEndSummary() {
  try {
    const [profile, detail] = await Promise.all([
      getProfile().catch(() => null),
      getSessionDetail(sessionId.value),
    ]);
    if (profile?.role) {
      const normalized = profile.role.toLowerCase();
      isAdmin.value = normalized.includes("admin") || normalized.includes("root") || normalized.includes("manager");
    }
    endScore.value = detail.score ?? null;
    endPromptsNotes.value = detail.prompts_notes ?? [];
    endPromptIds.value = detail.used_prompt_ids ?? [];
    const latest = detail.dialogue_log?.[detail.dialogue_log.length - 1];
    endSummary.value = latest?.expert_critique ?? null;
    endReference.value = latest?.reference_answer ?? null;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "训练总结加载失败。";
  }
}

async function handleSend() {
  if (!canSend.value) {
    return;
  }
  const content = inputText.value.trim();
  inputText.value = "";
  errorMessage.value = "";
  pushMessage("user", content);

  isSending.value = true;
  try {
    const result = await sendChatMessage(sessionId.value, content);
    updateStateFromPayload(result);
    if (result.round?.customer_msg) {
      pushMessage("customer", result.round.customer_msg, {
        sentiment: result.round.customer_sentiment,
        critique: result.round.expert_critique,
        reference: result.round.reference_answer,
      });
    }
    if (result.status) {
      await handleStatusRedirect(result.status);
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "发送失败。";
  } finally {
    isSending.value = false;
  }
}

async function handleTerminate() {
  if (!sessionId.value) {
    return;
  }
  isTerminating.value = true;
  errorMessage.value = "";
  try {
    await terminateSession(sessionId.value);
    status.value = "terminated";
    await handleStatusRedirect("terminated");
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "终止失败。";
  } finally {
    isTerminating.value = false;
  }
}

function handleBack() {
  router.push("/training/select");
}

onMounted(() => {
  if (!sessionId.value) {
    errorMessage.value = "缺少会话编号。";
    return;
  }
  sseClient = createSseClient<SsePayload>(`/sessions/${sessionId.value}/stream`, undefined, {
    onMessage: (payload) => {
      updateStateFromPayload(payload);
      if (payload.customer_msg) {
        pushMessage("customer", payload.customer_msg);
      }
    },
    onError: () => {
      errorMessage.value = "SSE 连接中断，请检查网络或重新进入。";
      handleStatusRedirect("terminated");
    },
  });
});

onBeforeUnmount(() => {
  sseClient?.close();
});
</script>

<template>
  <div class="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-6 px-6 py-10">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p class="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">训练对话</p>
        <h1 class="text-3xl font-semibold text-slate-900">实时训练面板</h1>
        <p class="mt-2 text-sm text-slate-600">会话编号：{{ sessionId }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" @click="handleBack">返回选择</Button>
        <Button variant="destructive" :disabled="isTerminating" @click="handleTerminate">
          {{ isTerminating ? "终止中..." : "终止训练" }}
        </Button>
      </div>
    </header>

    <p v-if="errorMessage" class="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ errorMessage }}
    </p>

    <div class="grid gap-6 lg:grid-cols-[1fr_2fr]">
      <Card class="rounded-3xl">
        <CardHeader>
          <CardTitle class="text-lg">会话状态</CardTitle>
          <CardDescription>实时同步的怒气值与进度</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p class="text-xs text-slate-500">当前怒气值</p>
            <p class="text-2xl font-semibold text-slate-900">{{ currentAnger ?? "-" }}</p>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p class="text-xs text-slate-500">历史最高怒气值</p>
            <p class="text-2xl font-semibold text-slate-900">{{ maxAnger ?? "-" }}</p>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p class="text-xs text-slate-500">当前轮次</p>
            <p class="text-2xl font-semibold text-slate-900">{{ turnCount ?? "-" }}</p>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p class="text-xs text-slate-500">状态</p>
            <p class="text-lg font-semibold text-slate-900">{{ status }}</p>
          </div>
        </CardContent>
      </Card>

      <Card class="flex flex-col rounded-3xl">
        <CardHeader>
          <CardTitle class="text-lg">对话内容</CardTitle>
          <CardDescription>模拟顾客的回复将通过 SSE 推送。</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-1 flex-col gap-4">
          <div class="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white/60 p-4">
            <div
              v-for="message in messages"
              :key="message.id"
              class="rounded-2xl px-4 py-3"
              :class="message.role === 'user' ? 'bg-slate-900 text-white ml-auto' : message.role === 'customer' ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-700'"
            >
              <p class="text-xs uppercase tracking-[0.2em] text-slate-400" v-if="message.role !== 'user'">
                {{ message.role === 'customer' ? '顾客' : '系统' }}
              </p>
              <p class="text-sm leading-relaxed">{{ message.content }}</p>
              <div v-if="message.sentiment || message.critique || message.reference" class="mt-3 space-y-2 text-xs text-slate-500">
                <p v-if="message.sentiment">情感标签：{{ message.sentiment }}</p>
                <p v-if="message.critique">专家点评：{{ message.critique }}</p>
                <p v-if="message.reference">参考答案：{{ message.reference }}</p>
              </div>
            </div>
            <p v-if="!messages.length" class="text-sm text-slate-500">暂无消息，请发送第一条客服应答。</p>
          </div>

          <div class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <Input v-model="inputText" placeholder="输入客服应答内容" @keyup.enter="handleSend" />
            <div class="flex flex-wrap items-center justify-between gap-3">
              <span class="text-xs text-slate-500">按 Enter 发送，或点击按钮提交。</span>
              <Button :disabled="!canSend" @click="handleSend">
                {{ isSending ? "发送中..." : "发送" }}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <div v-if="showEndModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-6">
      <Card class="w-full max-w-2xl rounded-3xl">
        <CardHeader>
          <CardTitle class="text-2xl">训练已结束</CardTitle>
          <CardDescription>以下为训练评分总结与参考答案。</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="grid gap-3 md:grid-cols-2">
            <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p class="text-xs text-slate-500">评分</p>
              <p class="text-2xl font-semibold text-slate-900">{{ endScore ?? "-" }}</p>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p class="text-xs text-slate-500">会话编号</p>
              <p class="text-sm font-semibold text-slate-900">{{ sessionId }}</p>
            </div>
          </div>
          <div v-if="endSummary" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            评分总结：{{ endSummary }}
          </div>
          <div v-if="endReference" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            标准参考答案：{{ endReference }}
          </div>
          <div v-if="endPromptsNotes.length" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            提示词备注：{{ endPromptsNotes.join(" / ") }}
          </div>
          <div v-if="isAdmin && endPromptIds.length" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            提示词编号：{{ endPromptIds.join(", ") }}
          </div>
          <div class="flex flex-wrap gap-3">
            <Button variant="outline" @click="router.push('/training/history')">查看训练历史</Button>
            <Button @click="router.push(`/training/review/${sessionId}`)">进入完整复盘</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
