<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

interface Props {
  class?: HTMLAttributes["class"];
  modelValue?: string | number;
  modelModifiers?: {
    number?: boolean;
    trim?: boolean;
  };
  type?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{ "update:modelValue": [value: string | number] }>();

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  let value: string | number = target.value;

  if (props.modelModifiers?.trim && typeof value === "string") {
    value = value.trim();
  }

  if (props.modelModifiers?.number) {
    const parsed = Number(value);
    value = Number.isNaN(parsed) ? value : parsed;
  }

  emit("update:modelValue", value);
}
</script>

<template>
  <input
    :type="type ?? 'text'"
    :class="cn(
      'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
      props.class,
    )"
    :value="modelValue"
    @input="handleInput"
  />
</template>
