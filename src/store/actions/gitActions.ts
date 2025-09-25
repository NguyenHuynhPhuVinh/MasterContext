// src/store/actions/gitActions.ts
import { StateCreator } from "zustand";
import { AppState } from "../appStore";
import { type GitRepositoryInfo, type GitCommit } from "../types";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { message } from "@tauri-apps/plugin-dialog";

const COMMITS_PER_PAGE = 20;

export interface GitActions {
  checkGitRepo: () => Promise<void>;
  fetchGitCommits: (loadMore?: boolean) => Promise<void>;
  reloadGitCommits: () => Promise<void>;
  exportCommitDiff: (commitSha: string) => Promise<void>;
  copyCommitDiff: (commitSha: string) => Promise<boolean>;
}

export const createGitActions: StateCreator<AppState, [], [], GitActions> = (
  set,
  get
) => ({
  checkGitRepo: async () => {
    const { rootPath } = get();
    if (!rootPath) return;

    set({ gitLogState: "loading_repo" });
    try {
      const info = await invoke<GitRepositoryInfo>("check_git_repository", {
        path: rootPath,
      });
      set({ gitRepoInfo: info });
      if (info.isRepository) {
        get().actions.fetchGitCommits();
      } else {
        set({ gitLogState: "idle" });
      }
    } catch (e) {
      console.error("Failed to check git repo:", e);
      set({ gitLogState: "error" });
    }
  },

  fetchGitCommits: async (loadMore = false) => {
    const { rootPath, gitLogState, gitCurrentPage } = get();
    if (!rootPath || gitLogState === "loading_commits") return;

    const pageToFetch = loadMore ? gitCurrentPage + 1 : 1;
    set({ gitLogState: "loading_commits" });

    try {
      const newCommits = await invoke<GitCommit[]>("get_git_commits", {
        path: rootPath,
        page: pageToFetch,
        pageSize: COMMITS_PER_PAGE,
      });

      set((state) => ({
        gitCommits:
          pageToFetch === 1 ? newCommits : [...state.gitCommits, ...newCommits],
        gitCurrentPage: pageToFetch,
        hasMoreCommits: newCommits.length === COMMITS_PER_PAGE,
        gitLogState: "idle",
      }));
    } catch (e) {
      console.error("Failed to fetch git commits:", e);
      set({ gitLogState: "error" });
    }
  },

  reloadGitCommits: async () => {
    get().actions.fetchGitCommits(false);
  },

  exportCommitDiff: async (commitSha: string) => {
    const { rootPath } = get();
    if (!rootPath) return;

    try {
      const diffContent = await invoke<string>("get_commit_diff", {
        path: rootPath,
        commitSha,
      });

      const filePath = await save({
        title: `Lưu diff cho commit ${commitSha.substring(0, 7)}`,
        defaultPath: `${commitSha.substring(0, 7)}.diff.txt`,
        filters: [{ name: "Diff File", extensions: ["diff", "patch"] }],
      });

      if (filePath) {
        await writeTextFile(filePath, diffContent);
        await message(
          `Đã lưu diff của commit ${commitSha.substring(0, 7)} vào file.`,
          { title: "Thành công", kind: "info" }
        );
      }
    } catch (e) {
      message(`Không thể tạo file diff: ${e}`, { title: "Lỗi", kind: "error" });
    }
  },

  copyCommitDiff: async (commitSha: string): Promise<boolean> => {
    const { rootPath } = get();
    if (!rootPath) return false;

    try {
      const diffContent = await invoke<string>("get_commit_diff", {
        path: rootPath,
        commitSha,
      });
      await writeText(diffContent);
      return true;
    } catch (e) {
      message(`Không thể sao chép diff: ${e}`, {
        title: "Lỗi",
        kind: "error",
      });
      return false;
    }
  },
});
