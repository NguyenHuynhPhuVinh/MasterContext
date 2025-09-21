// src/store/appStore.ts
import { create } from "zustand";
import { join, dirname } from "@tauri-apps/api/path";

// --- PHẦN MỚI: Định nghĩa kiểu dữ liệu cho một nhóm ---
export interface Group {
  id: string; // Dùng ID duy nhất để dễ dàng cập nhật/xóa
  name: string;
  description: string;
}

interface AppState {
  rootPath: string | null;
  selectedPath: string | null;
  groups: Group[]; // <-- Thêm state cho các nhóm
  actions: {
    selectRootPath: (path: string) => void;
    navigateTo: (dirName: string) => Promise<void>;
    goBack: () => Promise<void>;
    reset: () => void;
    // --- PHẦN MỚI: Actions cho CRUD ---
    addGroup: (group: Omit<Group, "id">) => void;
    updateGroup: (group: Group) => void;
    deleteGroup: (groupId: string) => void;
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  rootPath: null,
  selectedPath: null,
  groups: [], // <-- Khởi tạo mảng rỗng
  actions: {
    selectRootPath: (path) => set({ rootPath: path, selectedPath: path }),
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

    // --- PHẦN MỚI: Logic cho CRUD ---
    addGroup: (newGroup) => {
      const groupWithId: Group = { ...newGroup, id: Date.now().toString() };
      set((state) => ({ groups: [...state.groups, groupWithId] }));
    },
    updateGroup: (updatedGroup) => {
      set((state) => ({
        groups: state.groups.map((g) =>
          g.id === updatedGroup.id ? updatedGroup : g
        ),
      }));
    },
    deleteGroup: (groupId) => {
      set((state) => ({
        groups: state.groups.filter((g) => g.id !== groupId),
      }));
    },
  },
}));

export const useAppActions = () => useAppStore((state) => state.actions);
