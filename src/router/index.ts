import { createRouter, createWebHistory } from "vue-router";
import AuthView from "@/views/AuthView.vue";
import TrainingSelectionView from "@/views/TrainingSelectionView.vue";
import AdminUsersView from "@/views/AdminUsersView.vue";
import TrainingChatView from "@/views/TrainingChatView.vue";
import TrainingHistoryView from "@/views/TrainingHistoryView.vue";
import TrainingReviewView from "@/views/TrainingReviewView.vue";
import TrainingTerminationView from "@/views/TrainingTerminationView.vue";
import AdminDialoguesView from "@/views/AdminDialoguesView.vue";
import AdminPromptsView from "@/views/AdminPromptsView.vue";
import AdminPromptTypesView from "@/views/AdminPromptTypesView.vue";
import ProfileView from "@/views/ProfileView.vue";
import { getProfile } from "@/lib/api";

type Profile = { id: number; username: string; role: string; created_at: string };

let cachedProfile: Profile | null = null;
let profilePromise: Promise<Profile> | null = null;

async function fetchProfile() {
  if (cachedProfile) {
    return cachedProfile;
  }
  if (!profilePromise) {
    profilePromise = getProfile().then((profile) => {
      cachedProfile = profile;
      profilePromise = null;
      return profile;
    }).catch((error) => {
      profilePromise = null;
      throw error;
    });
  }
  return profilePromise;
}

export function clearProfileCache() {
  cachedProfile = null;
  profilePromise = null;
}

function resolveHomePath(role: string) {
  const normalized = role.toLowerCase();
  if (normalized.includes("admin") || normalized.includes("root") || normalized.includes("manager")) {
    return "/admin/users";
  }
  return "/training/select";
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/login" },
    { path: "/login", name: "login", component: AuthView, meta: { public: true } },
    { path: "/register", name: "register", component: AuthView, meta: { public: true } },
    { path: "/training/select", name: "training-select", component: TrainingSelectionView, meta: { requiresAuth: true } },
    { path: "/training/chat/:id", name: "training-chat", component: TrainingChatView, meta: { requiresAuth: true } },
    { path: "/training/history", name: "training-history", component: TrainingHistoryView, meta: { requiresAuth: true } },
    { path: "/training/review/:id", name: "training-review", component: TrainingReviewView, meta: { requiresAuth: true } },
    { path: "/training/terminated", name: "training-terminated", component: TrainingTerminationView, meta: { requiresAuth: true } },
    { path: "/profile", name: "profile", component: ProfileView, meta: { requiresAuth: true } },
    { path: "/admin/users", name: "admin-users", component: AdminUsersView, meta: { requiresAuth: true, adminOnly: true } },
    { path: "/admin/dialogues", name: "admin-dialogues", component: AdminDialoguesView, meta: { requiresAuth: true, adminOnly: true } },
    { path: "/admin/prompts", name: "admin-prompts", component: AdminPromptsView, meta: { requiresAuth: true, adminOnly: true } },
    { path: "/admin/prompt-types", name: "admin-prompt-types", component: AdminPromptTypesView, meta: { requiresAuth: true, adminOnly: true } },
  ],
});

router.beforeEach(async (to) => {
  const isPublic = Boolean(to.meta.public);
  if (isPublic) {
    try {
      const profile = await fetchProfile();
      return resolveHomePath(profile.role);
    } catch {
      return true;
    }
  }

  if (to.meta.requiresAuth) {
    try {
      const profile = await fetchProfile();
      if (to.meta.adminOnly) {
        const normalized = profile.role.toLowerCase();
        if (!normalized.includes("admin") && !normalized.includes("root") && !normalized.includes("manager")) {
          return "/training/select";
        }
      }
      return true;
    } catch {
      cachedProfile = null;
      return "/login";
    }
  }

  return true;
});

export default router;
