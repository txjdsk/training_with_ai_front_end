import axios from "axios";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api";

type ApiResponse<T> = {
  code: number;
  msg: string;
  data: T;
};

function ensureHttps(url: string) {
  if (url.startsWith("http://")) {
    throw new Error("API 基础地址必须使用 https。");
  }
}

ensureHttps(apiBase);

const http = axios.create({
  baseURL: apiBase,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error?.response?.data?.msg ?? error?.response?.data?.message ?? error?.message ?? "请求失败。";
    return Promise.reject(new Error(message));
  },
);

async function requestJson<T>(config: {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  params?: Record<string, string | number | null | undefined>;
  data?: unknown;
}) {
  const response = await http.request<ApiResponse<T>>(config);
  const payload = response.data;
  if (payload?.code && payload.code !== 20000) {
    throw new Error(payload?.msg ?? "请求失败。");
  }
  return (payload?.data ?? ({} as T)) as T;
}

export async function login(username: string, password: string, rememberMe = false) {
  await requestJson<null>({
    method: "POST",
    url: "/auth/login",
    data: {
      username,
      password,
      rememberMe,
    },
  });
}

export async function register(username: string, password: string) {
  await requestJson<null>({ method: "POST", url: "/auth/register", data: { username, password } });
}

export async function logout() {
  await requestJson<null>({ method: "POST", url: "/auth/logout", data: {} });
}

export async function getProfile() {
  return requestJson<{ id: number; username: string; role: string; created_at: string }>({
    method: "GET",
    url: "/users/profile",
  });
}

export async function getPrompts(params: { type?: number; search?: string }) {
  return requestJson<Array<{ id: number; note: string; type: number }>>({
    method: "GET",
    url: "/prompts",
    params,
  });
}

export async function getPromptDetail(id: number) {
  return requestJson<{ id: number; category_id: number; content?: string; note: string; created_at?: string }>({
    method: "GET",
    url: `/prompts/${id}`,
  });
}

export async function createPrompt(payload: { category_id: number; content: string; note: string }) {
  return requestJson<{ id: number; category_id: number; content: string; note: string; created_at: string }>({
    method: "POST",
    url: "/prompts",
    data: payload,
  });
}

export async function updatePrompt(id: number, payload: { category_id: number; content: string; note: string }) {
  return requestJson<{ id: number; category_id: number; content: string; note: string; created_at: string }>({
    method: "PUT",
    url: `/prompts/${id}`,
    data: payload,
  });
}

export async function deletePrompt(id: number) {
  return requestJson<null>({
    method: "DELETE",
    url: `/prompts/${id}`,
  });
}

export async function optimizePrompt(id: number, requirement: string) {
  return requestJson<{ prompt_id: number; original_content: string; optimized_content: string }>({
    method: "POST",
    url: `/prompts/${id}/optimize`,
    data: { requirement },
  });
}

export async function createSession(promptIds: number[], difficulty: string) {
  return requestJson<{ session_id: string }>({
    method: "POST",
    url: "/sessions",
    data: {
      prompt_ids: promptIds,
      difficulty,
    },
  });
}

export async function sendChatMessage(sessionId: string, message: string) {
  return requestJson<{
    round: {
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
    status: string;
    current_anger: number;
    max_anger: number;
    turn_count: number;
  }>({
    method: "POST",
    url: `/sessions/${sessionId}/chat`,
    data: { message },
  });
}

export async function terminateSession(sessionId: string) {
  return requestJson<{ msg?: string }>({
    method: "POST",
    url: `/sessions/${sessionId}/terminate`,
    data: {},
  });
}

export async function getUsers(params: {
  username?: string;
  role?: string;
  start_time?: string;
  end_time?: string;
  page?: number;
  size?: number;
}) {
  return requestJson<{ total: number; list: Array<{ id: number; username: string; role: string; created_at: string }> }>({
    method: "GET",
    url: "/users",
    params,
  });
}

export async function createUser(payload: { username: string; password: string; role: string }) {
  return requestJson<{ id: number; username: string; role: string; created_at: string }>({
    method: "POST",
    url: "/users",
    data: payload,
  });
}

export async function updateUser(id: number, payload: { username: string; role: string; password?: string }) {
  return requestJson<{ id: number; username: string; role: string; created_at: string }>({
    method: "PUT",
    url: `/users/${id}`,
    data: payload,
  });
}

export async function deleteUser(id: number) {
  return requestJson<null>({
    method: "DELETE",
    url: `/users/${id}`,
  });
}

export async function getSessions(params: {
  username?: string;
  min_score?: number;
  max_score?: number;
  prompt_id?: number;
  start_time?: string;
  end_time?: string;
  page?: number;
  size?: number;
}) {
  return requestJson<{ total: number; list: Array<{ id: string; username?: string; score: number; finished_at: string; duration: number }> }>({
    method: "GET",
    url: "/sessions",
    params,
  });
}

export async function getSessionDetail(sessionId: string) {
  return requestJson<{
    id: string;
    score?: number;
    preview?: string;
    dialogue_log: Array<{
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
    }>;
    finished_at?: string;
    duration?: number;
    prompts_notes?: string[];
    used_prompt_ids?: number[];
    username?: string;
    user_id?: number;
  }>({
    method: "GET",
    url: `/sessions/${sessionId}`,
  });
}

export async function deleteSession(sessionId: string) {
  return requestJson<null>({
    method: "DELETE",
    url: `/sessions/${sessionId}`,
  });
}

export async function getPromptTypes() {
  return requestJson<Array<{ id: number; name: string }>>({
    method: "GET",
    url: "/prompt-types",
  });
}

export async function createPromptType(payload: { name: string }) {
  return requestJson<{ id: number; name: string }>({
    method: "POST",
    url: "/prompt-types",
    data: payload,
  });
}

export async function updatePromptType(id: number, name: string) {
  return requestJson<{ id: number; name: string }>({
    method: "PUT",
    url: `/prompt-types/${id}`,
    data: { name },
  });
}

export async function deletePromptType(id: number) {
  return requestJson<null>({
    method: "DELETE",
    url: `/prompt-types/${id}`,
  });
}
