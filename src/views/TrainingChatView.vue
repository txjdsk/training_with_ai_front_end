<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createSseClient } from "@/lib/sse";
import { getProfile, getSessionDetail, getSessions, sendChatMessage, terminateSession } from "@/lib/api";

type ChatMessage = {
  id: string;
  role: "user" | "customer" | "system";
  content: string;
  round?: number;
  critique?: string;
  polish?: string;
  reference?: string;
};

type SsePayload = {
  event?: "reply" | "review" | "preview";
  round?: number;
  preview?: string;
  customer_msg?: string;
  expert_critique?: string;
  polish_reply?: string;
  reference_answer?: string;
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
const latestRecordId = ref<string | null>(null);
const isAdmin = ref(false);
const messageContainer = ref<HTMLElement | null>(null);
const showCritique = ref(false);
const showPolish = ref(false);
const showReference = ref(false);

const canSend = computed(() => !!inputText.value.trim() && !isSending.value);

let sseClient: { close: () => void } | null = null;

function pushMessage(role: ChatMessage["role"], content: string, detail?: Partial<ChatMessage>) {
  messages.value.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    round: detail?.round,
    critique: detail?.critique,
    polish: detail?.polish,
    reference: detail?.reference,
  });
  scrollToBottom();
}

function scrollToBottom() {
  nextTick(() => {
    if (!messageContainer.value) {
      return;
    }
    messageContainer.value.scrollTop = messageContainer.value.scrollHeight;
  });
}

function updateProgressFromPayload(payload: SsePayload) {
  if (typeof payload.current_anger === "number") {
    currentAnger.value = payload.current_anger;
  }
  if (typeof payload.max_anger === "number") {
    maxAnger.value = payload.max_anger;
  }
  if (typeof payload.turn_count === "number") {
    turnCount.value = payload.turn_count;
  }
}

function updateStatusFromPayload(payload: SsePayload) {
  if (payload.status) {
    status.value = payload.status;
    handleStatusRedirect(payload.status);
  }
}

function handleReplyEvent(payload: SsePayload) {
  updateProgressFromPayload(payload);
  updateStatusFromPayload(payload);
  if (payload.customer_msg) {
    pushMessage("customer", payload.customer_msg, {
      round: payload.round,
    });
  }
}

function handleReviewEvent(payload: SsePayload) {
  updateProgressFromPayload(payload);
  if (!payload.round) {
    return;
  }
  const target = messages.value.find((message) => message.role === "customer" && message.round === payload.round);
  if (target) {
    if (payload.expert_critique) {
      target.critique = payload.expert_critique;
    }
    if (payload.polish_reply) {
      target.polish = payload.polish_reply;
    }
    if (payload.reference_answer) {
      target.reference = payload.reference_answer;
    }
  }
}

function handlePreviewEvent(payload: SsePayload) {
  updateProgressFromPayload(payload);
  if (!payload.preview) {
    return;
  }
  pushMessage("system", `前情回顾:\n${payload.preview}`);
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
      const [profile, listResult] = await Promise.all([
        getProfile().catch(() => null),
        getSessions({ page: 1, size: 20 }),
      ]);
      const resolvedId = (listResult.list ?? [])
      .slice()
      .sort((a, b) => {
        const timeA = a.finished_at ? Date.parse(a.finished_at) : Number.NaN;
        const timeB = b.finished_at ? Date.parse(b.finished_at) : Number.NaN;
        if (!Number.isNaN(timeA) && !Number.isNaN(timeB) && timeA !== timeB) {
          return timeB - timeA;
        }
        const idA = Number(a.id);
        const idB = Number(b.id);
        if (!Number.isNaN(idA) && !Number.isNaN(idB) && idA !== idB) {
          return idB - idA;
        }
        return 0;
      })
      .find((item) => item.id)?.id;
    if (!resolvedId) {
      throw new Error("未找到最新训练记录。");
    }
    latestRecordId.value = resolvedId;
    const detail = await getSessionDetail(resolvedId);
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
    await sendChatMessage(sessionId.value, content);
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

onMounted(() => {
  if (!sessionId.value) {
    errorMessage.value = "缺少会话编号。";
    return;
  }
  sseClient = createSseClient<SsePayload>(`/sessions/${sessionId.value}/stream`, undefined, {
    onMessage: (payload) => {
      if (payload.event === "review") {
        handleReviewEvent(payload);
      } else if (payload.event === "preview") {
        handlePreviewEvent(payload);
      } else {
        handleReplyEvent(payload);
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
  <div class="flex h-dvh w-full overflow-hidden bg-slate-50 text-slate-900">
    <!-- 左侧状态栏 -->
    <aside class="flex w-64 flex-col border-r border-slate-200 bg-white/50 backdrop-blur-sm">
      <div class="flex flex-col gap-2 border-b border-slate-200 px-5 py-6">
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">训练对话</p>
        <h1 class="text-xl font-semibold text-slate-900">实时训练面板</h1>
        <p class="text-xs text-slate-600 truncate" :title="sessionId">编号：{{ sessionId }}</p>
      </div>

      <div class="flex-1 overflow-y-auto px-5 py-6 space-y-4">
        <!-- 错误提示 -->
        <p v-if="errorMessage" class="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {{ errorMessage }}
        </p>

        <!-- 状态选项卡 -->
        <div class="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p class="text-[10px] text-slate-500 uppercase tracking-wider">当前怒气值</p>
          <p class="text-xl font-semibold text-slate-900">{{ currentAnger ?? "-" }}</p>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p class="text-[10px] text-slate-500 uppercase tracking-wider">历史最高怒气值</p>
          <p class="text-xl font-semibold text-slate-900">{{ maxAnger ?? "-" }}</p>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p class="text-[10px] text-slate-500 uppercase tracking-wider">当前轮次</p>
          <p class="text-xl font-semibold text-slate-900">{{ turnCount ?? "-" }}</p>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p class="text-[10px] text-slate-500 uppercase tracking-wider">状态</p>
          <p class="text-base font-semibold" :class="status === 'ongoing' ? 'text-emerald-600' : 'text-slate-900'">
            {{ status === 'ongoing' ? '进行中' : status }}
          </p>
        </div>
      </div>

      <!-- 底部操作区 -->
      <div class="border-t border-slate-200 p-4">
        <Button variant="destructive" class="w-full rounded-xl" :disabled="isTerminating" @click="handleTerminate">
          {{ isTerminating ? "终止中..." : "终止训练" }}
        </Button>
      </div>
    </aside>

    <!-- 右侧主对话区 -->
    <main class="flex flex-1 flex-col min-w-0 bg-white relative">
      <!-- 顶栏开关 -->
      <header class="flex h-14 shrink-0 items-center justify-end gap-5 border-b border-slate-100 bg-white/80 px-6 backdrop-blur-sm z-10">
        <label class="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors" @click.prevent="showCritique = !showCritique">
          <button
            type="button"
            role="switch"
            :aria-checked="showCritique"
            :class="showCritique ? 'bg-slate-900' : 'bg-slate-200'"
            class="relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
          >
            <span
              aria-hidden="true"
              :class="showCritique ? 'translate-x-3' : 'translate-x-0'"
              class="pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
            />
          </button>
          专家点评
        </label>
        <label class="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors" @click.prevent="showPolish = !showPolish">
          <button
            type="button"
            role="switch"
            :aria-checked="showPolish"
            :class="showPolish ? 'bg-slate-900' : 'bg-slate-200'"
            class="relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
          >
            <span
              aria-hidden="true"
              :class="showPolish ? 'translate-x-3' : 'translate-x-0'"
              class="pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
            />
          </button>
          斧正回复
        </label>
        <label class="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors" @click.prevent="showReference = !showReference">
          <button
            type="button"
            role="switch"
            :aria-checked="showReference"
            :class="showReference ? 'bg-slate-900' : 'bg-slate-200'"
            class="relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
          >
            <span
              aria-hidden="true"
              :class="showReference ? 'translate-x-3' : 'translate-x-0'"
              class="pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
            />
          </button>
          参考答案
        </label>
      </header>

      <!-- 消息列表区 -->
      <div ref="messageContainer" class="flex-1 overflow-y-auto scroll-smooth px-4 sm:px-10 lg:px-24 py-8 space-y-6">
        <div
          v-for="message in messages"
          :key="message.id"
          class="flex flex-col"
          :class="message.role === 'user' ? 'items-end' : 'items-start'"
        >
          <div
            class="max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm"
            :class="message.role === 'user' ? 'bg-slate-900 text-white rounded-tr-sm' : message.role === 'customer' ? 'bg-white border border-slate-200 text-slate-900 rounded-tl-sm' : 'bg-slate-100 text-slate-700 rounded-tl-sm'"
          >
            <p class="text-[10px] font-semibold uppercase tracking-wider mb-1 opacity-70" v-if="message.role !== 'user'">
              {{ message.role === 'customer' ? '顾客' : '系统' }}
            </p>
            <p class="text-[15px] leading-relaxed whitespace-pre-wrap word-break">{{ message.content }}</p>
          </div>
          
          <!-- 专家点评与参考答案气泡 -->
          <div v-if="(showCritique && message.critique) || (showPolish && message.polish) || (showReference && message.reference)" class="mt-2 max-w-[85%] space-y-2">
            <div v-if="showCritique && message.critique" class="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm text-blue-900">
              <span class="font-semibold text-blue-700">专家点评：</span>{{ message.critique }}
            </div>
            <div v-if="showPolish && message.polish" class="rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
              <span class="font-semibold text-amber-700">斧正回复：</span>{{ message.polish }}
            </div>
            <div v-if="showReference && message.reference" class="rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-900">
              <span class="font-semibold text-emerald-700">参考答案：</span>{{ message.reference }}
            </div>
          </div>
          <p v-else-if="message.role === 'customer' && (showCritique || showPolish || showReference)" class="mt-2 text-xs text-slate-400 pl-2">
            评估生成中...
          </p>
        </div>
        
        <div v-if="!messages.length" class="flex h-full items-center justify-center">
          <p class="text-sm text-slate-400">暂无对话记录，请在下方输入框发送您的第一条应答。</p>
        </div>
      </div>

      <!-- 底部输入区 -->
      <div class="flex-shrink-0 bg-white px-4 sm:px-10 lg:px-24 py-4 border-t border-slate-100">
        <div class="mx-auto w-full max-w-4xl relative">
          <div class="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50/50 px-3 py-2 shadow-sm transition-all focus-within:bg-white focus-within:border-slate-300 focus-within:ring-4 focus-within:ring-slate-900/5 hover:border-slate-300">
            <textarea
              v-model="inputText"
              rows="1"
              class="max-h-48 min-h-[44px] w-full resize-none bg-transparent py-2.5 px-1 text-[15px] outline-none placeholder:text-slate-400"
              placeholder="输入客服应答内容"
              @keydown.enter.exact.prevent="handleSend"
            ></textarea>
            <Button 
              :disabled="!canSend" 
              @click="handleSend" 
              class="mb-1 shrink-0 rounded-xl h-9 px-4 transition-transform active:scale-95"
            >
              {{ isSending ? "发送中..." : "发送" }}
            </Button>
          </div>
          <p class="mt-2 text-center text-[11px] text-slate-400">按 Enter 发送，Shift + Enter 换行，或点击发送按钮提交</p>
        </div>
      </div>
    </main>

    <div v-if="showEndModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-6 backdrop-blur-sm">
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
            <Button :disabled="!latestRecordId" @click="router.push(`/training/review/${latestRecordId}`)">进入完整复盘</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
