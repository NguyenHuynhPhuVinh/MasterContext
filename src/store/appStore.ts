// src/store/appStore.ts
import { create } from "zustand";
import { join, dirname } from "@tauri-apps/api/path";

interface AppState {
  rootPath: string | null;
  selectedPath: string | null;
  actions: {
    selectRootPath: (path: string) => void;
    navigateTo: (dirName: string) => Promise<void>;
    goBack: () => Promise<void>;
    reset: () => void;
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  rootPath: null,
  selectedPath: null,
  actions: {
    // Khi người dùng chọn một thư mục lần đầu
    selectRootPath: (path) => set({ rootPath: path, selectedPath: path }),

    // Đi vào thư mục con
    navigateTo: async (dirName) => {
      const currentPath = get().selectedPath;
      if (!currentPath) return;
      const newPath = await join(currentPath, dirName);
      set({ selectedPath: newPath });
    },

    // Quay lại một cấp
    goBack: async () => {
      const { selectedPath, rootPath, actions } = get();
      if (!selectedPath || !rootPath) return;

      if (selectedPath === rootPath) {
        actions.reset(); // Nếu đang ở gốc, quay về màn hình chính
      } else {
        const parentPath = await dirname(selectedPath);
        set({ selectedPath: parentPath });
      }
    },

    // Reset về trạng thái ban đầu
    reset: () => set({ rootPath: null, selectedPath: null }),
  },
}));

// Export các actions riêng để dễ sử dụng mà không cần render lại component
export const useAppActions = () => useAppStore((state) => state.actions);
