<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getProfile, login, register } from "@/lib/api";

const route = useRoute();
const router = useRouter();
const isSubmitting = ref(false);
const showPassword = ref(false);
const form = reactive({
  username: "",
  password: "",
  rememberMe: false,
});
const errors = reactive({
  username: "",
  password: "",
  form: "",
});
const successMessage = ref("");

const view = computed(() => (route.name === "register" ? "register" : "login"));
const title = computed(() => (view.value === "login" ? "欢迎回来" : "创建账号"));
const description = computed(() =>
  view.value === "login"
    ? "有账号？直接登录"
    : "注册新账号",
);

function resetErrors() {
  errors.username = "";
  errors.password = "";
  errors.form = "";
  successMessage.value = "";
}

function resetForm() {
  form.username = "";
  form.password = "";
  form.rememberMe = false;
  showPassword.value = false;
}

function validate() {
  resetErrors();
  if (!form.username.trim()) {
    errors.username = "请输入用户名。";
  } else if (form.username.trim().length < 3 || form.username.trim().length > 20) {
    errors.username = "用户名长度需为 3-20 个字符。";
  }

  if (!form.password) {
    errors.password = "请输入密码。";
  } else if (form.password.length < 6 || form.password.length > 32) {
    errors.password = "密码长度需为 6-32 个字符。";
  }

  return !errors.username && !errors.password;
}

function resolveRoleTarget(role: string) {
  const normalized = role.toLowerCase();
  if (normalized.includes("admin") || normalized.includes("root") || normalized.includes("manager")) {
    return "/admin/users";
  }
  return "/training/select";
}

async function handleSubmit() {
  if (!validate()) {
    return;
  }

  isSubmitting.value = true;
  resetErrors();
  try {
    if (view.value === "login") {
      await login(form.username.trim(), form.password, form.rememberMe);
      const profile = await getProfile();
      await router.push(resolveRoleTarget(profile.role));
    } else {
      await register(form.username.trim(), form.password);
      successMessage.value = "账号创建完成，请使用新账号登录。";
      resetForm();
      await router.push("/login");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "请求失败。";
    errors.form = message;
  } finally {
    isSubmitting.value = false;
  }
}

function switchView(nextView: "login" | "register") {
  resetErrors();
  if (nextView === "login") {
    router.push("/login");
  } else {
    router.push("/register");
  }
}
</script>

<template>
  <div class="mx-auto flex min-h-dvh w-full max-w-6xl items-stretch px-6 py-12">
    <div class="grid w-full gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
      <section class="flex flex-col justify-between rounded-3xl bg-white/70 p-10 shadow-sm ring-1 ring-slate-200/70 backdrop-blur">
        <div class="space-y-6">
          <p class="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Training With AI</p>
          <h1 class="text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
            我们的系统让<span class="text-blue-600">AI</span>成为训练伙伴<br />
            让<span class="text-blue-600">科技</span>助力客户服务培训
          </h1>
          <p class="text-base leading-relaxed text-slate-600">
            我们通过使用多智能体技术、情绪控制模型、专家反馈练习打造完美客户服务训练体验。同时低门槛的提示词修正润色体验也助你一臂之力。
          </p>
        </div>
        <div class="mt-10 grid gap-4 text-sm text-slate-600">
          <div class="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white px-4 py-3 shadow-sm">
            <span class="font-medium">我们也提供了更切合实际的场景</span>
            <span class="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">Feature</span>
          </div>
          <div class="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white px-4 py-3 shadow-sm">
            <span class="font-medium">我们还设计了更智能的评估体系</span>
            <span class="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">Feature</span>
          </div>
        </div>
      </section>

      <section class="flex items-center">
        <Card class="w-full rounded-3xl border border-slate-200/80 bg-white/90 shadow-lg backdrop-blur">
          <CardHeader class="space-y-2">
            <CardTitle class="text-2xl">{{ title }}</CardTitle>
            <CardDescription>{{ description }}</CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <div class="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              <Button
                :variant="view === 'login' ? 'default' : 'ghost'"
                class="w-full"
                @click="switchView('login')"
              >
                登录
              </Button>
              <Button
                :variant="view === 'register' ? 'default' : 'ghost'"
                class="w-full"
                @click="switchView('register')"
              >
                注册
              </Button>
            </div>

            <form class="space-y-5" @submit.prevent="handleSubmit">
              <div class="space-y-2">
                <Label for="username">用户名</Label>
                <Input
                  id="username"
                  v-model="form.username"
                  autocomplete="username"
                  placeholder="请输入用户名"
                />
                <p v-if="errors.username" class="text-xs text-destructive">{{ errors.username }}</p>
              </div>
              <div class="space-y-2">
                <Label for="password">密码</Label>
                <div class="relative">
                  <Input
                    id="password"
                    v-model="form.password"
                    :type="showPassword ? 'text' : 'password'"
                    autocomplete="current-password"
                    placeholder="请输入密码"
                    class="pr-12"
                  />
                  <button
                    type="button"
                    class="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-500 hover:text-slate-700"
                    @click="showPassword = !showPassword"
                    :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                  >
                    <svg
                      v-if="showPassword"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="h-4 w-4"
                    >
                      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    <svg
                      v-else
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="h-4 w-4"
                    >
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a17.38 17.38 0 0 1-3.35 4.87" />
                      <path d="M14.12 14.12a3 3 0 0 1-4.24-4.24" />
                      <path d="M9 9l6 6" />
                      <path d="M4.74 4.74l14.52 14.52" />
                      <path d="M3 12s3.5-6 10-6c1.21 0 2.35.2 3.4.56" />
                      <path d="M6.11 15.59A8.64 8.64 0 0 1 3 12" />
                    </svg>
                  </button>
                </div>
                <p v-if="errors.password" class="text-xs text-destructive">{{ errors.password }}</p>
              </div>
              <div v-if="view === 'login'" class="flex items-center gap-2 text-sm text-slate-600">
                <input
                  id="rememberMe"
                  v-model="form.rememberMe"
                  type="checkbox"
                  class="h-4 w-4 rounded border border-slate-300 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30"
                />
                <Label for="rememberMe">记住我</Label>
              </div>
              <p
                v-if="successMessage"
                class="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700"
              >
                {{ successMessage }}
              </p>
              <p
                v-if="errors.form"
                class="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {{ errors.form }}
              </p>
              <Button class="w-full" type="submit" :disabled="isSubmitting">
                {{ isSubmitting ? "处理中..." : view === "login" ? "登录" : "创建账号" }}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  </div>
</template>
