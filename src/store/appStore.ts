// src/store/appStore.ts
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { join, dirname } from "@tauri-apps/api/path";

// --- PHẦN MỚI: Định nghĩa kiểu dữ liệu ProjectData khớp với Rust ---
interface ProjectData {
  groups: Group[];
}

// --- INTERFACE MỚI TỪ RUST ---
interface GroupContextResult {
  context: string;
  token_count: number;
}

export interface ProjectStats {
  total_files: number;
  total_dirs: number;
  total_size: number;
  total_tokens: number;
}

export interface Group {
  id: string; // Dùng ID duy nhất để dễ dàng cập nhật/xóa
  name: string;
  description: string;
  paths: string[]; // <-- Thêm
  tokenCount: number; // <-- Thêm
}

interface AppState {
  rootPath: string | null;
  selectedPath: string | null;
  groups: Group[];
  // --- STATE MỚI ĐỂ ĐIỀU HƯỚNG ---
  activeScene: "dashboard" | "groupEditor";
  editingGroupId: string | null;
  // --- STATE MỚI ---
  projectStats: ProjectStats | null;
  isScanning: boolean;
  actions: {
    selectRootPath: (path: string) => Promise<void>; // <-- Chuyển thành async
    navigateTo: (dirName: string) => Promise<void>;
    goBack: () => Promise<void>;
    reset: () => void;
    addGroup: (group: Omit<Group, "id" | "paths" | "tokenCount">) => void;
    updateGroup: (group: Omit<Group, "paths" | "tokenCount">) => void;
    deleteGroup: (groupId: string) => void;
    // --- ACTIONS MỚI ---
    editGroupContent: (groupId: string) => void;
    showDashboard: () => void;
    updateGroupPaths: (groupId: string, paths: string[]) => Promise<void>;
  };
}

export const useAppStore = create<AppState>((set, get) => {
  // --- PHẦN MỚI: Hàm trợ giúp để lưu dữ liệu hiện tại ---
  const saveCurrentProjectData = async () => {
    const { rootPath, groups } = get();
    if (rootPath) {
      try {
        const dataToSave: ProjectData = { groups };
        await invoke("save_project_data", { path: rootPath, data: dataToSave });
      } catch (error) {
        console.error("Lỗi khi lưu dữ liệu dự án:", error);
      }
    }
  };

  return {
    rootPath: null,
    selectedPath: null,
    groups: [],
    activeScene: "dashboard", // <-- Giá trị mặc định
    editingGroupId: null,
    // --- GIÁ TRỊ MẶC ĐỊNH CHO STATE MỚI ---
    projectStats: null,
    isScanning: false,
    actions: {
      // --- CẬP NHẬT selectRootPath ĐỂ QUÉT VÀ LƯU STATS ---
      selectRootPath: async (path) => {
        set({ isScanning: true, projectStats: null }); // Bắt đầu quét
        try {
          // Tải dữ liệu nhóm đã lưu
          const projectData = await invoke<ProjectData>("load_project_data", {
            path,
          });

          // Quét và lấy thống kê tổng thể của dự án
          const stats = await invoke<ProjectStats>("get_project_stats", {
            path,
          });

          set({
            rootPath: path,
            selectedPath: path,
            groups: (projectData.groups || []).map((g) => ({
              ...g,
              paths: g.paths || [],
              tokenCount: g.tokenCount || 0,
            })),
            activeScene: "dashboard",
            projectStats: stats, // <-- Lưu stats vào store
          });
        } catch (error) {
          console.error("Lỗi khi tải hoặc quét dự án:", error);
          set({
            rootPath: path,
            selectedPath: path,
            groups: [],
            activeScene: "dashboard",
          });
        } finally {
          set({ isScanning: false }); // Kết thúc quét
        }
      },
      navigateTo: async (dirName) => {
        const currentPath = get().selectedPath;
        if (!currentPath) return;
        const newPath = await join(currentPath, dirName);
        set({ selectedPath: newPath });
      },
      goBack: async () => {
        const { selectedPath, rootPath, actions } = get();
        if (!selectedPath || !rootPath) return;
        if (selectedPath === rootPath) {
          actions.reset();
        } else {
          const parentPath = await dirname(selectedPath);
          set({ selectedPath: parentPath });
        }
      },
      reset: () =>
        set({
          rootPath: null,
          selectedPath: null,
          groups: [],
          activeScene: "dashboard",
          editingGroupId: null,
        }), // Reset cả groups

      // --- CẬP NHẬT: Gọi hàm save sau mỗi lần thay đổi ---
      addGroup: (newGroup) => {
        const groupWithDefaults: Group = {
          ...newGroup,
          id: Date.now().toString(),
          paths: [],
          tokenCount: 0,
        };
        set((state) => ({ groups: [...state.groups, groupWithDefaults] }));
        saveCurrentProjectData(); // <-- LƯU
      },
      updateGroup: (updatedGroup) => {
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === updatedGroup.id ? { ...g, ...updatedGroup } : g
          ),
        }));
        saveCurrentProjectData(); // <-- LƯU
      },
      deleteGroup: (groupId) => {
        set((state) => ({
          groups: state.groups.filter((g) => g.id !== groupId),
        }));
        saveCurrentProjectData(); // <-- LƯU
      },

      // --- CÁC ACTION MỚI ---
      editGroupContent: (groupId) => {
        set({ activeScene: "groupEditor", editingGroupId: groupId });
      },
      showDashboard: () => {
        set({ activeScene: "dashboard", editingGroupId: null });
      },
      updateGroupPaths: async (groupId, paths) => {
        const rootPath = get().rootPath;
        if (!rootPath) return;

        try {
          // Gọi backend để tính toán
          const result = await invoke<GroupContextResult>(
            "generate_context_for_paths",
            {
              rootPathStr: rootPath,
              paths,
            }
          );

          // Cập nhật state
          set((state) => ({
            groups: state.groups.map((g) =>
              g.id === groupId
                ? { ...g, paths, tokenCount: result.token_count }
                : g
            ),
          }));

          // Lưu lại
          saveCurrentProjectData();
        } catch (error) {
          console.error("Lỗi khi cập nhật paths của nhóm:", error);
        }
      },
    },
  };
});

export const useAppActions = () => useAppStore((state) => state.actions);
