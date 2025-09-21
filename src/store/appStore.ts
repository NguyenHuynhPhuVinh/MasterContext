// src/store/appStore.ts
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { join, dirname } from "@tauri-apps/api/path";

// --- PHẦN MỚI: Định nghĩa kiểu dữ liệu ProjectData khớp với Rust ---
interface ProjectData {
  groups: Group[];
}

export interface Group {
  id: string; // Dùng ID duy nhất để dễ dàng cập nhật/xóa
  name: string;
  description: string;
}

interface AppState {
  rootPath: string | null;
  selectedPath: string | null;
  groups: Group[];
  actions: {
    selectRootPath: (path: string) => Promise<void>; // <-- Chuyển thành async
    navigateTo: (dirName: string) => Promise<void>;
    goBack: () => Promise<void>;
    reset: () => void;
    addGroup: (group: Omit<Group, "id">) => void;
    updateGroup: (group: Group) => void;
    deleteGroup: (groupId: string) => void;
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
    actions: {
      // --- CẬP NHẬT: Tải dữ liệu khi chọn thư mục ---
      selectRootPath: async (path) => {
        try {
          const projectData = await invoke<ProjectData>("load_project_data", {
            path,
          });
          set({
            rootPath: path,
            selectedPath: path,
            groups: projectData.groups || [],
          });
        } catch (error) {
          console.error("Lỗi khi tải dữ liệu dự án:", error);
          // Nếu lỗi, vẫn tiếp tục với dữ liệu trống
          set({ rootPath: path, selectedPath: path, groups: [] });
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
      reset: () => set({ rootPath: null, selectedPath: null, groups: [] }), // Reset cả groups

      // --- CẬP NHẬT: Gọi hàm save sau mỗi lần thay đổi ---
      addGroup: (newGroup) => {
        const groupWithId: Group = { ...newGroup, id: Date.now().toString() };
        set((state) => ({ groups: [...state.groups, groupWithId] }));
        saveCurrentProjectData(); // <-- LƯU
      },
      updateGroup: (updatedGroup) => {
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === updatedGroup.id ? updatedGroup : g
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
    },
  };
});

export const useAppActions = () => useAppStore((state) => state.actions);
