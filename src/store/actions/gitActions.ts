// src/store/actions/gitActions.ts
import { StateCreator } from "zustand";
import { AppState } from "../appStore";
import {
  type GitRepositoryInfo,
  type GitCommit,
  type GitStatus,
} from "../types";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { message } from "@tauri-apps/plugin-dialog";

const COMMITS_PER_PAGE = 20;

export interface GitActions {
  fetchGitStatus: () => Promise<void>;
  checkGitRepo: () => Promise<void>;
  fetchGitCommits: (loadMore?: boolean) => Promise<void>;
  reloadGitCommits: () => Promise<void>;
  exportCommitDiff: (commitSha: string) => Promise<void>;
  copyCommitDiff: (commitSha: string) => Promise<boolean>;
  checkoutCommit: (commitSha: string) => Promise<void>;
  checkoutLatestBranch: () => Promise<void>;
}

export const createGitActions: StateCreator<AppState, [], [], GitActions> = (
  set,
  get
) => ({
  fetchGitStatus: async () => {
    const { rootPath, gitRepoInfo } = get();
    if (!rootPath || !gitRepoInfo?.isRepository) {
      set({ gitStatus: null });
      return;
    }
    try {
      const status = await invoke<GitStatus>("get_git_status", {
        path: rootPath,
      });
      set({ gitStatus: status });
    } catch (e) {
      console.error("Failed to get git status:", e);
      set({ gitStatus: null });
    }
  },

  checkGitRepo: async () => {
    const { rootPath } = get();
    if (!rootPath) return;

    set({ gitLogState: "loading_repo" });
    try {
      const info = await invoke<GitRepositoryInfo>("check_git_repository", {
        path: rootPath,
      });
      set((state) => ({
        gitRepoInfo: info,
        // Chốt tên nhánh ban đầu. Chỉ đặt lần đầu tiên khi nó còn null.
        // Điều này giúp nó tồn tại qua các lần checkout và rescan.
        originalGitBranch: state.originalGitBranch ?? info.currentBranch,
      }));
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
    // SỬA LỖI: Gọi checkGitRepo để làm mới cả trạng thái và danh sách commit
    get().actions.checkGitRepo();
  },

  exportCommitDiff: async (commitSha: string) => {
    const { rootPath, gitExportModeIsContext } = get();
    if (!rootPath) return;

    try {
      const command = gitExportModeIsContext
        ? "generate_commit_context"
        : "get_commit_diff";
      const content = await invoke<string>(command, {
        path: rootPath,
        commitSha,
      });

      const fileType = gitExportModeIsContext ? "ngữ cảnh" : "diff";
      const defaultPath = gitExportModeIsContext
        ? `commit_${commitSha.substring(0, 7)}_context.txt`
        : `${commitSha.substring(0, 7)}.diff.txt`;
      const filters = gitExportModeIsContext
        ? [{ name: "Text File", extensions: ["txt"] }]
        : [{ name: "Diff File", extensions: ["diff", "patch", "txt"] }];

      const filePath = await save({
        title: `Lưu ${fileType} cho commit ${commitSha.substring(0, 7)}`,
        defaultPath,
        filters,
      });

      if (filePath) {
        await writeTextFile(filePath, content);
        await message(
          `Đã lưu ${fileType} của commit ${commitSha.substring(
            0,
            7
          )} vào file.`,
          { title: "Thành công", kind: "info" }
        );
      }
    } catch (e) {
      const fileType = gitExportModeIsContext ? "ngữ cảnh" : "diff";
      message(`Không thể tạo file ${fileType}: ${e}`, {
        title: "Lỗi",
        kind: "error",
      });
    }
  },

  copyCommitDiff: async (commitSha: string): Promise<boolean> => {
    const { rootPath, gitExportModeIsContext } = get();
    if (!rootPath) return false;

    try {
      const command = gitExportModeIsContext
        ? "generate_commit_context"
        : "get_commit_diff";
      const content = await invoke<string>(command, {
        path: rootPath,
        commitSha,
      });
      await writeText(content);
      return true;
    } catch (e) {
      const fileType = gitExportModeIsContext ? "ngữ cảnh" : "diff";
      message(`Không thể sao chép ${fileType}: ${e}`, {
        title: "Lỗi",
        kind: "error",
      });
      return false;
    }
  },

  checkoutCommit: async (commitSha: string) => {
    const { rootPath } = get();
    if (!rootPath) return;

    try {
      await invoke("checkout_commit", {
        path: rootPath,
        commitSha,
      });
      // Trigger a full rescan to update the app state to the new file contents
      get().actions.rescanProject();
    } catch (e) {
      await message(`Không thể checkout commit: ${e}`, {
        title: "Lỗi",
        kind: "error",
      });
    }
  },

  checkoutLatestBranch: async () => {
    const { rootPath, originalGitBranch, gitRepoInfo } = get();
    const mainBranchHeadSha = gitRepoInfo?.mainBranchHeadSha;

    if (!rootPath || !originalGitBranch || !mainBranchHeadSha) {
      await message("Không thể xác định commit mới nhất để quay về.", {
        title: "Lỗi",
        kind: "error",
      });
      return;
    }

    try {
      // An toàn hơn là checkout về commit SHA cụ thể, sau đó mới về nhánh
      await invoke("checkout_commit", {
        path: rootPath,
        commitSha: mainBranchHeadSha,
      });
      await invoke("checkout_branch", {
        path: rootPath,
        branch: originalGitBranch,
      });
      get().actions.rescanProject();
    } catch (e) {
      await message(`Không thể checkout nhánh: ${e}`, {
        title: "Lỗi",
        kind: "error",
      });
    }
  },
});
