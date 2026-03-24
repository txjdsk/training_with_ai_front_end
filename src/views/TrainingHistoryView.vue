<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteSession, getSessions } from "@/lib/api";

type SessionItem = {
  id: string;
  username?: string;
  score: number;
  finished_at: string;
  duration: number;
};

const router = useRouter();
const filters = reactive({
  username: "",
  min_score: "",
  max_score: "",
  prompt_id: "",
  start_time: "",
  end_time: "",
  page: 1,
  size: 10,
});
const sessions = ref<SessionItem[]>([]);
const total = ref(0);
const isLoading = ref(false);
const errorMessage = ref("");
const isDeleting = ref<string | null>(null);

async function fetchSessions() {
  isLoading.value = true;
  errorMessage.value = "";
  try {
    const result = await getSessions({
      username: filters.username || undefined,
      min_score: filters.min_score ? Number(filters.min_score) : undefined,
      max_score: filters.max_score ? Number(filters.max_score) : undefined,
      prompt_id: filters.prompt_id ? Number(filters.prompt_id) : undefined,
      start_time: filters.start_time || undefined,
      end_time: filters.end_time || undefined,
      page: filters.page,
      size: filters.size,
    });
    sessions.value = result.list ?? [];
    total.value = result.total ?? 0;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "训练记录加载失败。";
  } finally {
    isLoading.value = false;
  }
}

function resetFilters() {
  filters.username = "";
  filters.min_score = "";
  filters.max_score = "";
  filters.prompt_id = "";
  filters.start_time = "";
  filters.end_time = "";
  filters.page = 1;
  filters.size = 10;
  fetchSessions();
}

function openDetail(id: string) {
  router.push(`/training/review/${id}`);
}

async function handleDelete(id: string) {
  if (!confirm("确定要删除该训练记录吗？")) {
    return;
  }
  isDeleting.value = id;
  try {
    await deleteSession(id);
    await fetchSessions();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "删除失败。";
  } finally {
    isDeleting.value = null;
  }
}

function nextPage() {
  filters.page += 1;
  fetchSessions();
}

function prevPage() {
  filters.page = Math.max(1, filters.page - 1);
  fetchSessions();
}

onMounted(() => {
  fetchSessions();
});
</script>

<template>
  <div class="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-8 px-6 py-10">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p class="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">训练历史</p>
        <h1 class="text-3xl font-semibold text-slate-900">训练记录查看</h1>
        <p class="mt-2 text-sm text-slate-600">按条件筛选训练记录并查看复盘详情。</p>
      </div>
      <Button variant="outline" @click="router.push('/training/select')">返回选择</Button>
    </header>

    <Card class="rounded-3xl">
      <CardHeader>
        <CardTitle class="text-lg">筛选条件</CardTitle>
        <CardDescription>支持按时间、分数与提示词筛选。</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 md:grid-cols-4">
        <div class="space-y-2">
          <Label>用户名</Label>
          <Input v-model="filters.username" placeholder="输入用户名" />
        </div>
        <div class="space-y-2">
          <Label>最小分数</Label>
          <Input v-model="filters.min_score" placeholder="0" />
        </div>
        <div class="space-y-2">
          <Label>最大分数</Label>
          <Input v-model="filters.max_score" placeholder="100" />
        </div>
        <div class="space-y-2">
          <Label>提示词 ID</Label>
          <Input v-model="filters.prompt_id" placeholder="提示词编号" />
        </div>
        <div class="space-y-2">
          <Label>开始日期</Label>
          <Input v-model="filters.start_time" type="date" />
        </div>
        <div class="space-y-2">
          <Label>结束日期</Label>
          <Input v-model="filters.end_time" type="date" />
        </div>
        <div class="md:col-span-4 flex flex-wrap gap-3">
          <Button :disabled="isLoading" @click="fetchSessions">{{ isLoading ? "查询中..." : "查询" }}</Button>
          <Button variant="outline" @click="resetFilters">重置</Button>
        </div>
      </CardContent>
    </Card>

    <p v-if="errorMessage" class="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ errorMessage }}
    </p>

    <Card class="rounded-3xl">
      <CardHeader>
        <CardTitle class="text-lg">训练记录列表</CardTitle>
        <CardDescription>共 {{ total }} 条记录，第 {{ filters.page }} 页。</CardDescription>
      </CardHeader>
      <CardContent class="space-y-3">
        <div
          v-for="session in sessions"
          :key="session.id"
          class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
        >
          <div>
            <p class="text-sm font-semibold text-slate-900">评分：{{ session.score }}</p>
            <p class="text-xs text-slate-500">
              记录 ID: {{ session.id }} · {{ session.finished_at || "-" }} · 时长 {{ session.duration }}s
              <span v-if="session.username"> · 用户：{{ session.username }}</span>
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" @click="openDetail(session.id)">查看详情</Button>
            <Button size="sm" variant="destructive" :disabled="isDeleting === session.id" @click="handleDelete(session.id)">
              {{ isDeleting === session.id ? "删除中..." : "删除" }}
            </Button>
          </div>
        </div>
        <p v-if="!sessions.length && !isLoading" class="text-sm text-slate-500">暂无记录。</p>
        <div v-if="sessions.length" class="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Button variant="outline" :disabled="filters.page <= 1" @click="prevPage">上一页</Button>
          <span class="text-xs text-slate-500">每页 {{ filters.size }} 条</span>
          <Button variant="outline" :disabled="sessions.length < filters.size" @click="nextPage">下一页</Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
