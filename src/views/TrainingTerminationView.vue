<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const route = useRoute();
const router = useRouter();

const reason = computed(() => String(route.query.reason || ""));
const sessionId = computed(() => String(route.query.id || ""));

const title = computed(() => (reason.value === "manual" ? "训练已终止" : "训练异常终止"));
const description = computed(() =>
  reason.value === "manual"
    ? "你已主动中止训练，本次成绩不计入有效考核。"
    : "训练连接异常中断，本次成绩不计入有效考核。",
);
</script>

<template>
  <div class="mx-auto flex min-h-dvh w-full max-w-4xl items-center px-6 py-12">
    <Card class="w-full rounded-3xl">
      <CardHeader>
        <CardTitle class="text-2xl">{{ title }}</CardTitle>
        <CardDescription>{{ description }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-6">
        <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          会话编号：{{ sessionId || "-" }}
        </div>
        <div class="flex flex-wrap gap-3">
          <Button @click="router.push('/training/select')">返回选择</Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
