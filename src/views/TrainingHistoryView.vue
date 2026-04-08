<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteSession, getProfile, getSessions, getUsers } from "@/lib/api";

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
const userOptions = ref<{ id: number; username: string }[]>([]);
const total = ref(0);
const isLoading = ref(false);
const errorMessage = ref("");
const isDeleting = ref<string | null>(null);
const isAdmin = ref(false);

const sortKey = ref<"score" | "finished_at" | "duration" | null>(null);
const sortDesc = ref(false);

function handleSort(key: "score" | "finished_at" | "duration") {
  if (sortKey.value === key) {
    if (sortDesc.value) {
      sortKey.value = null; // 恢复默认
      sortDesc.value = false;
    } else {
      sortDesc.value = true; // 降序
    }
  } else {
    sortKey.value = key;
    sortDesc.value = false; // 升序
  }
}

const displayedSessions = computed(() => {
  let list = [...sessions.value];
  if (sortKey.value) {
    list.sort((a, b) => {
      const order = sortDesc.value ? -1 : 1;
      if (sortKey.value === "score") {
        return (a.score - b.score) * order;
      } else if (sortKey.value === "duration") {
        return (a.duration - b.duration) * order;
      } else if (sortKey.value === "finished_at") {
        const timeA = a.finished_at ? new Date(a.finished_at).getTime() : 0;
        const timeB = b.finished_at ? new Date(b.finished_at).getTime() : 0;
        return (timeA - timeB) * order;
      }
      return 0;
    });
  }
  return list;
});

function formatDate(isoString: string) {
  if (!isoString) return "-";
  const d = new Date(isoString);
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).replace(/\//g, "-");
}

async function fetchUserOptions() {
  try {
    const result = await getUsers({ page: 1, size: 1000 });
    userOptions.value = result.list || [];
  } catch (error) {
    console.error("加载用户列表失败", error);
  }
}

async function fetchSessions() {
  isLoading.value = true;
  errorMessage.value = "";
  try {
    const usernameVal = filters.username === "all" ? undefined : filters.username || undefined;
    const result = await getSessions({
      username: usernameVal,
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

onMounted(async () => {
  try {
    const profile = await getProfile();
    const role = profile.role?.toLowerCase() || "user";
    isAdmin.value = role.includes("admin") || role.includes("root") || role.includes("manager");
  } catch (error) {
    console.error("加载个人信息失败", error);
  }

  if (isAdmin.value) {
    fetchUserOptions();
  }
  fetchSessions();
});
</script>

<template>
  <div class="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-8 px-6 py-10">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-semibold text-slate-900">训练记录查看</h1>
        <p class="mt-2 text-sm text-slate-600">按条件筛选训练记录并查看复盘详情。</p>
      </div>
    </header>

    <Card class="rounded-3xl">
      <CardHeader>
        <CardTitle class="text-lg">筛选条件</CardTitle>
        <CardDescription>支持按时间、分数与提示词筛选。</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 md:grid-cols-4">
        <div class="space-y-2" v-if="isAdmin">
          <Label>用户名</Label>
          <Input 
            v-model="filters.username" 
            list="user-list" 
            placeholder="输入或选择，留空为不限" 
            autocomplete="off" 
          />
          <datalist id="user-list">
            <option v-for="u in userOptions" :key="u.id" :value="u.username">{{ u.username }}</option>
          </datalist>
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
          <Label>最早从</Label>
          <Input v-model="filters.start_time" type="date" />
        </div>
        <div class="space-y-2">
          <Label>最晚到</Label>
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
        <CardDescription>共查询到 {{ total }} 条相关记录。</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="rounded-xl border shadow-sm overflow-hidden min-h-[100px]">
          <Table>
            <TableHeader class="bg-slate-100/50">
              <TableRow>
                <TableHead v-if="isAdmin" class="border-r px-6 font-semibold text-slate-700 w-[140px]">用户名</TableHead>
                <TableHead
                  class="w-[120px] border-r px-4 text-center font-semibold text-slate-700 cursor-pointer select-none hover:bg-slate-200/50 transition-colors"
                  @click="handleSort('score')"
                >
                  评分 <span class="text-xs text-slate-400 inline-block w-3">{{ sortKey === 'score' ? (sortDesc ? '↓' : '↑') : '' }}</span>
                </TableHead>
                <TableHead
                  class="w-[140px] border-r px-4 text-center font-semibold text-slate-700 cursor-pointer select-none hover:bg-slate-200/50 transition-colors"
                  @click="handleSort('duration')"
                >
                  时长(秒) <span class="text-xs text-slate-400 inline-block w-3">{{ sortKey === 'duration' ? (sortDesc ? '↓' : '↑') : '' }}</span>
                </TableHead>
                <TableHead
                  class="border-r px-6 text-center font-semibold text-slate-700 w-[200px] cursor-pointer select-none hover:bg-slate-200/50 transition-colors"
                  @click="handleSort('finished_at')"
                >
                  完成时间 <span class="text-xs text-slate-400 inline-block w-3">{{ sortKey === 'finished_at' ? (sortDesc ? '↓' : '↑') : '' }}</span>
                </TableHead>
                <TableHead class="w-[180px] px-4 text-center font-semibold text-slate-700">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="(session, index) in displayedSessions"
                :key="session.id"
                class="hover:bg-slate-100/50 transition-colors"
                :class="index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'"
              >
                <TableCell v-if="isAdmin" class="border-r px-6 text-slate-700 font-medium">
                   {{ session.username || "未知用户" }}
                </TableCell>
                <TableCell class="border-r px-4 text-center font-medium">
                  <span
                    class="font-semibold"
                    :class="session.score >= 80 ? 'text-emerald-600' : session.score >= 60 ? 'text-amber-600' : 'text-red-500'"
                  >
                    {{ session.score }}
                  </span>
                </TableCell>
                <TableCell class="border-r px-4 text-center text-slate-700">{{ session.duration }}</TableCell>
                <TableCell class="border-r px-6 text-center text-slate-600 text-sm">
                  {{ formatDate(session.finished_at) }}
                </TableCell>
                <TableCell class="px-4">
                  <div class="flex justify-center gap-2">
                    <Button size="sm" variant="outline" @click="openDetail(session.id)">详情</Button>
                    <Button size="sm" variant="destructive" :disabled="isDeleting === session.id" @click="handleDelete(session.id)">
                      {{ isDeleting === session.id ? "..." : "删除" }}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              <TableRow v-if="!displayedSessions.length && !isLoading">
                <TableCell :colspan="isAdmin ? 5 : 4" class="h-32 text-center text-sm text-slate-500 bg-slate-50/50">
                  暂无记录。
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        
        <!-- 分页控件 -->
        <div class="flex flex-wrap items-center justify-between gap-3 pt-6">
          <Button variant="outline" :disabled="filters.page <= 1" @click="prevPage">上一页</Button>
          <span class="text-sm font-medium text-slate-600">第 {{ filters.page }} 页</span>
          <Button variant="outline" :disabled="sessions.length < filters.size" @click="nextPage">下一页</Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
