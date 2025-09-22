// src/store/appStore.ts
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { join, dirname } from "@tauri-apps/api/path";

// --- DI CHUYỂN TOÀN BỘ CÁC HÀM HELPER VÀO ĐÂY ---
// Điều này giúp tập trung logic xử lý state ở một nơi duy nhất.

const getDescendantAndSelfPaths = (node: FileNode): string[] => {
  const paths = [node.path];
  if (Array.isArray(node.children)) {
    node.children.forEach((child) => {
      paths.push(...getDescendantAndSelfPaths(child));
    });
  }
  return paths;
};

const areAllDescendantsSelected = (
  node: FileNode,
  selectedPaths: Set<string>
): boolean => {
  if (!selectedPaths.has(node.path)) return false;
  if (Array.isArray(node.children)) {
    return node.children.every((child) =>
      areAllDescendantsSelected(child, selectedPaths)
    );
  }
  return true;
};

const prunePathsForSave = (
  rootNode: FileNode,
  selectedPaths: Set<string>
): string[] => {
  const pruned: string[] = [];
  function traverse(node: FileNode) {
    if (!selectedPaths.has(node.path)) return;
    if (areAllDescendantsSelected(node, selectedPaths)) {
      pruned.push(node.path);
      return;
    }
    if (!Array.isArray(node.children) && selectedPaths.has(node.path)) {
      pruned.push(node.path);
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }
  if (Array.isArray(rootNode.children)) {
    for (const child of rootNode.children) {
      traverse(child);
    }
  }
  // Xử lý trường hợp chỉ có thư mục gốc được chọn
  if (
    pruned.length === 0 &&
    selectedPaths.has(rootNode.path) &&
    areAllDescendantsSelected(rootNode, selectedPaths)
  ) {
    pruned.push(rootNode.path);
  }
  return pruned;
};

const expandPaths = (
  rootNode: FileNode,
  savedPaths: Set<string>
): Set<string> => {
  const expanded = new Set<string>();
  function traverse(node: FileNode, isAncestorSelected: boolean): boolean {
    let isSelected = isAncestorSelected || savedPaths.has(node.path);
    if (isSelected && Array.isArray(node.children)) {
      getDescendantAndSelfPaths(node).forEach((p) => expanded.add(p));
      return true;
    }
    if (isSelected) {
      expanded.add(node.path);
    }
    if (Array.isArray(node.children)) {
      let hasSelectedDescendant = false;
      for (const child of node.children) {
        if (traverse(child, isSelected)) {
          hasSelectedDescendant = true;
        }
      }
      if (hasSelectedDescendant) {
        expanded.add(node.path);
        return true;
      }
    }
    return expanded.has(node.path);
  }
  traverse(rootNode, false);
  return expanded;
};

// --- PHẦN MỚI: Định nghĩa kiểu dữ liệu ProjectData khớp với Rust ---
// Thay thế bằng CachedProjectData
export interface CachedProjectData {
  stats: ProjectStats | null;
  file_tree: FileNode | null;
  groups: Group[];
}

// Thêm FileNode interface
export interface FileNode {
  name: string;
  path: string;
  children?: FileNode[] | null;
}

// --- INTERFACE MỚI CHO THỐNG KÊ NHÓM ---
export interface GroupStats {
  total_files: number;
  total_dirs: number;
  total_size: number;
  token_count: number;
}

// --- INTERFACE CHO THỐNG KÊ TỔNG QUAN DỰ ÁN ---
export interface ProjectStats {
  total_files: number;
  total_dirs: number;
  total_size: number;
  total_tokens: number;
}

// --- INTERFACE MỚI CHO TIẾN TRÌNH QUÉT ---
export interface ScanProgress {
  currentFile: string | null;
}

// --- HÀM TẠO STATS MẶC ĐỊNH ---
const defaultGroupStats = (): GroupStats => ({
  total_files: 0,
  total_dirs: 0,
  total_size: 0,
  token_count: 0,
});

export interface Group {
  id: string; // Dùng ID duy nhất để dễ dàng cập nhật/xóa
  name: string;
  description: string;
  paths: string[]; // <-- Thêm
  stats: GroupStats; // <-- Thay thế tokenCount
}

// --- INTERFACE MỚI TỪ RUST ---
/*
interface GroupContextResult {
  context: string;
  stats: GroupStats; // <-- Nhận về stats
}
*/

// Payload từ sự kiện scan_complete
// interface ScanCompletePayload {
//   stats: ProjectStats;
//   fileTree: FileNode;
// }

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
  scanProgress: ScanProgress; // <-- THÊM STATE MỚI
  fileTree: FileNode | null; // <-- THÊM STATE MỚI
  isUpdatingGroupId: string | null; // <-- State loading khi lưu nhóm
  // --- STATE MỚI ---
  tempSelectedPaths: Set<string> | null; // State tạm để chỉnh sửa cây thư mục

  actions: {
    selectRootPath: (path: string) => Promise<void>; // <-- Chuyển thành async
    navigateTo: (dirName: string) => Promise<void>;
    goBack: () => Promise<void>;
    reset: () => void;
    addGroup: (group: Omit<Group, "id" | "paths" | "stats">) => void;
    updateGroup: (group: Omit<Group, "paths" | "stats">) => void;
    deleteGroup: (groupId: string) => void;
    // --- ACTIONS MỚI ---
    editGroupContent: (groupId: string) => void;
    showDashboard: () => void;
    updateGroupPaths: (groupId: string, paths: string[]) => Promise<void>;
    // --- THÊM CÁC ACTION "NỘI BỘ" ĐỂ XỬ LÝ SỰ KIỆN ---
    _setScanProgress: (file: string) => void;
    _setScanComplete: (payload: CachedProjectData) => void;
    _setScanError: (error: string) => void;
    // --- ACTIONS MỚI ---
    _setGroupUpdateComplete: (payload: {
      groupId: string;
      stats: GroupStats;
      paths: string[];
    }) => void;
    // --- ACTIONS MỚI CHO VIỆC CHỈNH SỬA NHÓM ---
    startEditingGroup: (groupId: string) => void;
    toggleEditingPath: (node: FileNode, isSelected: boolean) => void;
    cancelEditingGroup: () => void;
    saveEditingGroup: () => Promise<void>;
  };
}

export const useAppStore = create<AppState>((set, get) => {
  // --- PHẦN MỚI: Hàm trợ giúp để lưu dữ liệu hiện tại ---
  const saveCurrentProjectData = async () => {
    const { rootPath, groups, projectStats, fileTree } = get();
    if (rootPath) {
      try {
        const dataToSave: CachedProjectData = {
          stats: projectStats,
          file_tree: fileTree,
          groups,
        };
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
    scanProgress: { currentFile: null }, // <-- GIÁ TRỊ MẶC ĐỊNH
    fileTree: null,
    isUpdatingGroupId: null,
    tempSelectedPaths: null, // Giá trị mặc định
    actions: {
      // --- CẬP NHẬT selectRootPath ---
      selectRootPath: async (path) => {
        set({
          isScanning: true,
          projectStats: null,
          fileTree: null,
          groups: [],
        });
        try {
          // Tải dữ liệu cache
          const data = await invoke<CachedProjectData>("load_project_data", {
            path,
          });
          if (data && data.stats && data.file_tree) {
            // Nếu có cache, dùng ngay
            set({
              rootPath: path,
              selectedPath: path,
              projectStats: data.stats,
              fileTree: data.file_tree,
              groups: (data.groups || []).map((g) => ({
                ...g,
                paths: g.paths || [],
                stats: g.stats || defaultGroupStats(),
              })),
              isScanning: false,
              activeScene: "dashboard",
            });
          } else {
            // Nếu không có cache, bắt đầu quét
            await invoke("start_project_scan", { path });
          }
        } catch (error) {
          console.error("Lỗi khi tải dự án:", error);
          // Nếu lỗi, vẫn bắt đầu quét mới
          await invoke("start_project_scan", { path });
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

      addGroup: (newGroup) => {
        const groupWithDefaults: Group = {
          ...newGroup,
          id: Date.now().toString(),
          paths: [],
          stats: defaultGroupStats(), // <-- Dùng stats mặc định
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
        get().actions.startEditingGroup(groupId);
        set({ activeScene: "groupEditor", editingGroupId: groupId });
      },
      showDashboard: () => {
        set({ activeScene: "dashboard", editingGroupId: null });
      },
      updateGroupPaths: async (groupId, paths) => {
        const rootPath = get().rootPath;
        if (!rootPath) return;
        set({ isUpdatingGroupId: groupId }); // Bật loading
        await invoke("start_group_update", {
          groupId,
          rootPathStr: rootPath,
          paths,
        });
      },

      // --- CÁC ACTION MỚI ĐỂ XỬ LÝ SỰ KIỆN TỪ RUST ---
      _setScanProgress: (file) => {
        set({ scanProgress: { currentFile: file } });
      },
      _setScanComplete: (payload: CachedProjectData) => {
        set({
          projectStats: payload.stats,
          fileTree: payload.file_tree,
          groups: (payload.groups || []).map((g) => ({
            ...g,
            paths: g.paths || [],
            stats: g.stats || defaultGroupStats(),
          })),
          isScanning: false,
        });
      },
      _setScanError: (error) => {
        console.error("Scan error from Rust:", error);
        alert(`Đã xảy ra lỗi khi quét dự án: ${error}`);
        set({ isScanning: false });
      },
      // --- ACTIONS MỚI ---
      _setGroupUpdateComplete: ({ groupId, stats, paths }) => {
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === groupId
              ? // --- THAY ĐỔI: Sử dụng `paths` trực tiếp từ payload ---
                { ...g, paths: paths, stats: stats }
              : g
          ),
          isUpdatingGroupId: null, // Tắt loading
        }));
        // --- THAY ĐỔI: Gọi cancelEditingGroup để dọn dẹp và navigate ---
        get().actions.cancelEditingGroup();
        saveCurrentProjectData(); // Lưu lại toàn bộ project data sau khi cập nhật
      },
      // --- LOGIC CHỈNH SỬA NHÓM ĐƯỢC TẬP TRUNG TẠI ĐÂY ---

      startEditingGroup: (groupId: string) => {
        const { groups, fileTree } = get();
        const group = groups.find((g) => g.id === groupId);
        if (group && fileTree) {
          // Khởi tạo state tạm thời bằng cách EXPAND các path đã lưu
          const expanded = expandPaths(fileTree, new Set(group.paths));
          set({ tempSelectedPaths: expanded });
        }
      },

      toggleEditingPath: (toggledNode: FileNode, isSelected: boolean) => {
        const { tempSelectedPaths } = get();
        if (!tempSelectedPaths) return;

        const newSelectedPaths = new Set(tempSelectedPaths);
        const pathsToToggle = getDescendantAndSelfPaths(toggledNode);

        if (isSelected) {
          pathsToToggle.forEach((p) => newSelectedPaths.add(p));
        } else {
          pathsToToggle.forEach((p) => newSelectedPaths.delete(p));
        }
        set({ tempSelectedPaths: newSelectedPaths });
      },

      cancelEditingGroup: () => {
        set({
          activeScene: "dashboard",
          editingGroupId: null,
          tempSelectedPaths: null,
        });
      },

      saveEditingGroup: async () => {
        const { editingGroupId, tempSelectedPaths, fileTree } = get();
        if (editingGroupId && tempSelectedPaths && fileTree) {
          // 1. Prune the expanded UI paths back to a minimal set for saving
          const pathsToSave = prunePathsForSave(fileTree, tempSelectedPaths);

          // 2. Call the async update action
          await get().actions.updateGroupPaths(editingGroupId, pathsToSave);

          // 3. Clean up and navigate back - sẽ được xử lý bởi _setGroupUpdateComplete
        }
      },
    },
  };
});

export const useAppActions = () => useAppStore((state) => state.actions);
