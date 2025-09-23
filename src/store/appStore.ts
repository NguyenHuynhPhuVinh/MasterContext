// src/store/appStore.ts
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { open, message } from "@tauri-apps/plugin-dialog"; // <-- THAY ĐỔI IMPORT
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import {
  type CachedProjectData,
  type FileNode,
  type GroupStats,
  type ProjectStats,
  type ScanProgress,
  type Group,
  type FileMetadata,
} from "./types";
import {
  getDescendantAndSelfPaths,
  prunePathsForSave,
  expandPaths,
} from "@/lib/treeUtils";

// --- DI CHUYỂN TOÀN BỘ CÁC HÀM HELPER VÀO ĐÂY ---
// Điều này giúp tập trung logic xử lý state ở một nơi duy nhất.

// --- PHẦN MỚI: Định nghĩa kiểu dữ liệu ProjectData khớp với Rust ---
// Thay thế bằng CachedProjectData

// Thêm FileNode interface

// --- INTERFACE MỚI CHO THỐNG KÊ NHÓM ---

// --- INTERFACE MỚI CHO METADATA FILE ---

// --- INTERFACE CHO THỐNG KÊ TỔNG QUAN DỰ ÁN ---

// --- HÀM TẠO STATS MẶC ĐỊNH ---
const defaultGroupStats = (): GroupStats => ({
  total_files: 0,
  total_dirs: 0,
  total_size: 0,
  token_count: 0,
});

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
  activeScene: "dashboard" | "groupEditor" | "settings"; // <-- THÊM MỚI
  editingGroupId: string | null;
  // --- STATE MỚI ---
  projectStats: ProjectStats | null;
  isScanning: boolean;
  scanProgress: ScanProgress; // <-- THÊM STATE MỚI
  fileTree: FileNode | null; // <-- THÊM STATE MỚI
  isUpdatingGroupId: string | null; // <-- State loading khi lưu nhóm
  // --- STATE MỚI ---
  tempSelectedPaths: Set<string> | null; // State tạm để chỉnh sửa cây thư mục
  fileMetadataCache: Record<string, FileMetadata> | null; // <-- THÊM STATE NÀY
  isCrossLinkingEnabled: boolean; // <-- THÊM STATE NÀY
  // --- STATE MỚI CHO CÀI ĐẶT ĐỒNG BỘ ---
  syncEnabled: boolean;
  syncPath: string | null;
  customIgnorePatterns: string[]; // <-- THÊM STATE MỚI
  // --- STATE MỚI CHO HỒ SƠ ---
  profiles: string[];
  activeProfile: string;
  isWatchingFiles: boolean; // <-- THÊM STATE MỚI

  actions: {
    selectRootPath: (path: string) => Promise<void>;
    openFolderFromMenu: () => Promise<void>; // <-- THÊM ACTION MỚI
    rescanProject: () => Promise<void>;
    reset: () => void;
    addGroup: (group: Omit<Group, "id" | "paths" | "stats">) => void;
    updateGroup: (group: Omit<Group, "paths" | "stats">) => void;
    deleteGroup: (groupId: string) => void;
    // --- ACTIONS MỚI ---
    editGroupContent: (groupId: string) => void;
    showDashboard: () => void;
    showSettingsScene: () => void; // <-- THÊM ACTION MỚI
    updateGroupPaths: (groupId: string, paths: string[]) => void;
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
    setCrossLinkingEnabled: (enabled: boolean) => void; // <-- THÊM ACTION NÀY
    selectAllFiles: () => void; // <-- THÊM ACTION NÀY
    deselectAllFiles: () => void; // <-- THÊM ACTION NÀY
    // --- ACTION MỚI CHO CÀI ĐẶT ---
    setSyncSettings: (settings: {
      enabled: boolean;
      path: string | null;
    }) => Promise<void>;
    setGroupCrossSync: (groupId: string, enabled: boolean) => Promise<void>; // <-- THÊM ACTION MỚI
    setCustomIgnorePatterns: (patterns: string[]) => Promise<void>; // <-- THÊM ACTION MỚI
    // --- ACTIONS MỚI CHO HỒ SƠ ---
    switchProfile: (profileName: string) => Promise<void>;
    createProfile: (profileName: string) => Promise<void>;
    renameProfile: (oldName: string, newName: string) => Promise<void>;
    deleteProfile: (profileName: string) => Promise<void>;
    setFileWatching: (enabled: boolean) => Promise<void>; // <-- THÊM ACTION MỚI
    exportProject: () => void;
    copyProjectToClipboard: () => Promise<void>;
  };
}

export const useAppStore = create<AppState>((set, get) => {
  // --- HÀM HELPER MỚI ĐỂ TẢI DỮ LIỆU CỦA MỘT HỒ SƠ ---
  const loadProfileData = (path: string, profileName: string) => {
    set({
      isScanning: true,
      activeProfile: profileName,
      scanProgress: { currentFile: `Đang tải hồ sơ "${profileName}"...` },
    });
    try {
      invoke("open_project", { path, profileName });
    } catch (error) {
      console.error(`Lỗi khi tải hồ sơ ${profileName}:`, error);
      set({ isScanning: false });
      message(`Không thể tải hồ sơ: ${profileName}.`, {
        title: "Lỗi",
        kind: "error",
      });
    }
  };

  // --- PHẦN MỚI: Hàm trợ giúp để cập nhật groups trên backend ---
  const updateGroupsOnBackend = async () => {
    const { rootPath, groups, activeProfile } = get();
    if (rootPath) {
      try {
        await invoke("update_groups_in_project_data", {
          path: rootPath,
          profileName: activeProfile,
          groups: groups,
        });
      } catch (error) {
        console.error("Lỗi khi cập nhật nhóm trên backend:", error);
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
    fileMetadataCache: null, // <-- Thêm giá trị mặc định
    isCrossLinkingEnabled: false, // <-- Thêm giá trị mặc định
    // --- GIÁ TRỊ MẶC ĐỊNH CHO CÀI ĐẶT ĐỒNG BỘ ---
    syncEnabled: false,
    syncPath: null,
    customIgnorePatterns: [], // <-- GIÁ TRỊ MẶC ĐỊNH
    // --- GIÁ TRỊ MẶC ĐỊNH CHO STATE HỒ SƠ ---
    profiles: ["default"],
    activeProfile: "default",
    isWatchingFiles: false, // <-- GIÁ TRỊ MẶC ĐỊNH
    actions: {
      // --- CẬP NHẬT selectRootPath ---
      selectRootPath: async (path) => {
        // Dừng watcher cũ trước khi chuyển dự án
        const { isWatchingFiles } = get();
        if (isWatchingFiles) {
          await invoke("stop_file_watching");
        }

        set({
          rootPath: path,
          selectedPath: path,
          activeScene: "dashboard",
          isScanning: true,
          scanProgress: { currentFile: "Đang tìm các hồ sơ..." },
        });

        try {
          const profiles = await invoke<string[]>("list_profiles", {
            projectPath: path,
          });
          set({ profiles });
          // Tải hồ sơ 'default' sau khi chọn một thư mục mới
          loadProfileData(path, "default");

          // Bắt đầu watcher mới nếu cần
          if (isWatchingFiles) {
            await invoke("start_file_watching", { path });
          }
        } catch (error) {
          console.error("Lỗi khi lấy danh sách hồ sơ:", error);
          set({
            isScanning: false,
            profiles: ["default"],
            activeProfile: "default",
          });
          await message("Không thể lấy danh sách hồ sơ.", {
            title: "Lỗi",
            kind: "error",
          });
        }
      },

      // --- ACTION MỚI ĐỂ XỬ LÝ MENU CLICK ---
      openFolderFromMenu: async () => {
        try {
          const result = await open({
            directory: true,
            multiple: false,
            title: "Chọn một thư mục dự án",
          });
          if (typeof result === "string") {
            // Gọi action đã có để xử lý logic chọn thư mục
            get().actions.selectRootPath(result);
          }
        } catch (error) {
          console.error("Lỗi khi chọn thư mục từ menu:", error);
          await message("Không thể mở thư mục.", {
            title: "Lỗi",
            kind: "error",
          });
        }
      },

      // --- THÊM MỚI: Logic cho action rescanProject ---
      rescanProject: async () => {
        const { rootPath, activeProfile } = get();
        if (!rootPath) return;
        loadProfileData(rootPath, activeProfile);
      },
      reset: () =>
        set({
          rootPath: null,
          selectedPath: null,
          groups: [],
          activeScene: "dashboard",
          editingGroupId: null,
          profiles: ["default"],
          activeProfile: "default",
        }), // Reset cả groups

      // --- THAY ĐỔI: Chuyển hướng ngay sau khi tạo nhóm ---
      addGroup: (newGroup) => {
        const groupWithDefaults: Group = {
          ...newGroup,
          id: Date.now().toString(),
          paths: [],
          stats: defaultGroupStats(),
          crossSyncEnabled: false,
          tokenLimit: newGroup.tokenLimit || undefined, // Đảm bảo trường mới được thêm vào
        };
        // Cập nhật state để thêm nhóm mới và chuyển sang màn hình chỉnh sửa
        set((state) => ({
          groups: [...state.groups, groupWithDefaults],
          activeScene: "groupEditor",
          editingGroupId: groupWithDefaults.id,
        }));
        // Khởi tạo trạng thái chỉnh sửa cho nhóm mới (ví dụ: tempSelectedPaths)
        get().actions.startEditingGroup(groupWithDefaults.id);
        // Lưu lại sự thay đổi trên backend
        updateGroupsOnBackend();
      },
      updateGroup: (updatedGroup) => {
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === updatedGroup.id ? { ...g, ...updatedGroup } : g
          ),
        }));
        updateGroupsOnBackend(); // <-- GỌI HÀM MỚI
      },
      deleteGroup: (groupId) => {
        set((state) => ({
          groups: state.groups.filter((g) => g.id !== groupId),
        }));
        updateGroupsOnBackend(); // <-- GỌI HÀM MỚI
      },

      // --- CÁC ACTION MỚI ---
      editGroupContent: (groupId) => {
        get().actions.startEditingGroup(groupId);
        set({ activeScene: "groupEditor", editingGroupId: groupId });
      },
      showDashboard: () => {
        set({ activeScene: "dashboard", editingGroupId: null });
      },
      showSettingsScene: () => {
        // <-- THÊM ACTION MỚI
        set({ activeScene: "settings" });
      },
      updateGroupPaths: (groupId, paths) => {
        // Không cần async nữa
        const { rootPath, activeProfile } = get();
        if (!rootPath) return;
        set({ isUpdatingGroupId: groupId });

        // Chỉ "bắn" lệnh đi và không chờ đợi
        invoke("start_group_update", {
          groupId,
          rootPathStr: rootPath,
          profileName: activeProfile,
          paths,
        });
        // Logic sẽ được tiếp tục trong listener sự kiện `group_update_complete`
      },

      // --- CÁC ACTION MỚI ĐỂ XỬ LÝ SỰ KIỆN TỪ RUST ---
      _setScanProgress: (file) => {
        set({ scanProgress: { currentFile: file } });
      },
      _setScanComplete: (payload: CachedProjectData) => {
        set({
          projectStats: payload.stats,
          fileTree: payload.file_tree,
          // --- THAY ĐỔI: Lưu cả file metadata cache ---
          fileMetadataCache: payload.file_metadata_cache,
          groups: (payload.groups || []).map((g) => ({
            ...g,
            paths: g.paths || [],
            stats: g.stats || defaultGroupStats(),
            crossSyncEnabled: (g as any).cross_sync_enabled ?? false, // <-- XỬ LÝ DỮ LIỆU MỚI
            tokenLimit: g.tokenLimit, // <-- XỬ LÝ DỮ LIỆU MỚI
          })),
          isScanning: false,
          // Cập nhật cài đặt đồng bộ từ file đã tải
          syncEnabled: payload.sync_enabled ?? false,
          syncPath: payload.sync_path ?? null,
          customIgnorePatterns: payload.custom_ignore_patterns ?? [], // <-- CẬP NHẬT STATE
          isWatchingFiles: payload.is_watching_files ?? false, // <-- CẬP NHẬT STATE TỪ FILE
          // file_metadata_cache được backend quản lý, frontend không cần lưu
        });
      },
      _setScanError: (error) => {
        console.error("Scan error from Rust:", error);
        // Alert/toast đã được xử lý ở App.tsx, ở đây chỉ cần cập nhật state
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
        // Backend đã lưu trong start_group_update, không cần lưu lại
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
        const { isCrossLinkingEnabled, fileMetadataCache, tempSelectedPaths } =
          get();
        if (!tempSelectedPaths || !fileMetadataCache) return;

        const newSelectedPaths = new Set(tempSelectedPaths);

        if (isSelected) {
          // --- LOGIC MỚI CHO VIỆC CHỌN VÀ LIÊN KẾT CHÉO ---
          const pathsToAdd = new Set<string>();
          const queue = [toggledNode.path]; // Bắt đầu với node được chọn
          const visited = new Set<string>();

          // Nếu bật liên kết chéo, duyệt đồ thị phụ thuộc
          if (isCrossLinkingEnabled) {
            while (queue.length > 0) {
              const currentPath = queue.shift()!;
              if (visited.has(currentPath)) continue;

              visited.add(currentPath);
              pathsToAdd.add(currentPath);

              const metadata = fileMetadataCache[currentPath];
              if (metadata && metadata.links) {
                for (const link of metadata.links) {
                  if (!visited.has(link)) {
                    queue.push(link);
                  }
                }
              }
            }
          } else {
            // Nếu không, chỉ thêm node được chọn và các con của nó
            getDescendantAndSelfPaths(toggledNode).forEach((p) =>
              pathsToAdd.add(p)
            );
          }

          // Thêm tất cả các đường dẫn tìm được vào set chính
          pathsToAdd.forEach((p) => newSelectedPaths.add(p));

          // Luôn thêm các thư mục cha để UI hiển thị đúng
          const allPathsArray = Array.from(newSelectedPaths);
          for (const path of allPathsArray) {
            let parentPath = path;
            while (parentPath.lastIndexOf("/") > -1) {
              parentPath = parentPath.substring(0, parentPath.lastIndexOf("/"));
              newSelectedPaths.add(parentPath);
            }
          }
          newSelectedPaths.add("");
        } else {
          // Khi bỏ chọn, chỉ bỏ chọn node đó và các con của nó
          const pathsToRemove = getDescendantAndSelfPaths(toggledNode);
          pathsToRemove.forEach((p) => newSelectedPaths.delete(p));
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
      setCrossLinkingEnabled: (enabled: boolean) => {
        set({ isCrossLinkingEnabled: enabled });
      },

      // --- THÊM 2 ACTIONS MỚI Ở ĐÂY ---
      selectAllFiles: () => {
        const { fileTree } = get();
        if (!fileTree) return;

        // Lấy tất cả các đường dẫn có thể có từ fileTree
        const allPaths = getDescendantAndSelfPaths(fileTree);
        set({ tempSelectedPaths: new Set(allPaths) });
      },

      deselectAllFiles: () => {
        // Đơn giản là set thành một Set rỗng, nhưng vẫn giữ lại đường dẫn gốc ""
        // để cây thư mục không bị lỗi (logic prune/expand dựa vào sự tồn tại của "")
        set({ tempSelectedPaths: new Set([""]) });
      },

      // --- ACTION MỚI CHO CÀI ĐẶT ĐỒNG BỘ ---
      setSyncSettings: async ({ enabled, path }) => {
        const { rootPath, activeProfile } = get();
        if (!rootPath) return;

        // Cập nhật state ở frontend ngay lập tức
        set({ syncEnabled: enabled, syncPath: path });

        // Gọi backend để lưu cài đặt
        try {
          await invoke("update_sync_settings", {
            path: rootPath,
            profileName: activeProfile,
            enabled,
            syncPath: path,
          });
          await message("Lưu cài đặt đồng bộ thành công!", {
            title: "Thành công",
            kind: "info",
          });
        } catch (error) {
          console.error("Lỗi khi lưu cài đặt đồng bộ:", error);
          await message("Không thể lưu cài đặt đồng bộ.", {
            title: "Lỗi",
            kind: "error",
          });
        }
      },

      // <-- BẮT ĐẦU SỬA LỖI -->
      setGroupCrossSync: async (groupId, enabled) => {
        const { rootPath, activeProfile } = get(); // <-- Lấy thêm activeProfile
        if (!rootPath) return;

        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === groupId ? { ...g, crossSyncEnabled: enabled } : g
          ),
        }));

        try {
          // <-- Thêm `profileName` vào payload
          await invoke("set_group_cross_sync", {
            path: rootPath,
            profileName: activeProfile,
            groupId,
            enabled,
          });
        } catch (error) {
          console.error("Lỗi khi cập nhật cài đặt đồng bộ chéo:", error);
          await message(`Không thể cập nhật đồng bộ chéo: ${error}`, {
            title: "Lỗi",
            kind: "error",
          });
          set((state) => ({
            groups: state.groups.map((g) =>
              g.id === groupId ? { ...g, crossSyncEnabled: !enabled } : g
            ),
          }));
        }
      },
      // <-- KẾT THÚC SỬA LỖI -->
      // --- ACTION MỚI ĐỂ LƯU CÁC MẪU LOẠI TRỪ ---
      setCustomIgnorePatterns: async (patterns: string[]) => {
        const { rootPath, activeProfile } = get();
        if (!rootPath) return;

        // Cập nhật UI ngay lập tức
        set({ customIgnorePatterns: patterns });

        // Gọi backend để lưu
        try {
          await invoke("update_custom_ignore_patterns", {
            path: rootPath,
            profileName: activeProfile,
            patterns,
          });
          await message("Đã lưu các mẫu loại trừ. Bắt đầu quét lại dự án...", {
            title: "Thành công",
            kind: "info",
          });
          // Kích hoạt quét lại để áp dụng các thay đổi
          await get().actions.rescanProject();
        } catch (error) {
          console.error("Lỗi khi lưu các mẫu loại trừ tùy chỉnh:", error);
          await message("Không thể lưu các mẫu loại trừ.", {
            title: "Lỗi",
            kind: "error",
          });
        }
      },
      // --- ACTIONS MỚI CHO HỒ SƠ ---
      switchProfile: async (profileName: string) => {
        const { rootPath, activeProfile } = get();
        if (!rootPath || profileName === activeProfile) return;
        loadProfileData(rootPath, profileName);
      },
      createProfile: async (profileName: string) => {
        const { rootPath, profiles } = get();
        if (!rootPath || profiles.includes(profileName)) {
          await message("Tên hồ sơ đã tồn tại.", {
            title: "Lỗi",
            kind: "error",
          });
          return;
        }
        try {
          await invoke("create_profile", {
            projectPath: rootPath,
            profileName,
          });
          set({ profiles: [...profiles, profileName] });
          get().actions.switchProfile(profileName);
          await message(`Đã tạo và chuyển sang hồ sơ "${profileName}"`, {
            title: "Thành công",
            kind: "info",
          });
        } catch (error) {
          console.error("Lỗi khi tạo hồ sơ:", error);
          await message(`Không thể tạo hồ sơ: ${error}`, {
            title: "Lỗi",
            kind: "error",
          });
        }
      },
      renameProfile: async (oldName: string, newName: string) => {
        const { rootPath, profiles } = get();
        if (!rootPath || profiles.includes(newName)) {
          await message("Tên hồ sơ mới đã tồn tại.", {
            title: "Lỗi",
            kind: "error",
          });
          return;
        }
        try {
          await invoke("rename_profile", {
            projectPath: rootPath,
            oldName,
            newName,
          });
          set({
            profiles: profiles.map((p) => (p === oldName ? newName : p)),
            activeProfile: newName,
          });
          await message(`Đã đổi tên hồ sơ thành "${newName}"`, {
            title: "Thành công",
            kind: "info",
          });
        } catch (error) {
          console.error("Lỗi khi đổi tên hồ sơ:", error);
          await message(`Không thể đổi tên hồ sơ: ${error}`, {
            title: "Lỗi",
            kind: "error",
          });
        }
      },
      deleteProfile: async (profileName: string) => {
        const { rootPath, profiles } = get();
        if (!rootPath || profileName === "default") return;
        try {
          await invoke("delete_profile", {
            projectPath: rootPath,
            profileName,
          });
          set({ profiles: profiles.filter((p) => p !== profileName) });
          // Chuyển về hồ sơ default sau khi xóa
          get().actions.switchProfile("default");
          await message(`Đã xóa hồ sơ "${profileName}"`, {
            title: "Thành công",
            kind: "info",
          });
        } catch (error) {
          console.error("Lỗi khi xóa hồ sơ:", error);
          await message(`Không thể xóa hồ sơ: ${error}`, {
            title: "Lỗi",
            kind: "error",
          });
        }
      },
      // --- ACTION MỚI ĐỂ BẬT/TẮT THEO DÕI FILE ---
      setFileWatching: async (enabled: boolean) => {
        const { rootPath, activeProfile } = get();
        if (!rootPath) return;

        // 1. Lưu cài đặt vào file trước
        try {
          await invoke("set_file_watching_setting", {
            path: rootPath,
            profileName: activeProfile,
            enabled,
          });
        } catch (error) {
          console.error("Lỗi khi lưu cài đặt theo dõi file:", error);
          await message(`Không thể lưu cài đặt: ${error}`, {
            title: "Lỗi",
            kind: "error",
          });
          return; // Dừng lại nếu không lưu được
        }

        // 2. Cập nhật state và bắt đầu/dừng watcher
        set({ isWatchingFiles: enabled });

        try {
          if (enabled) {
            await invoke("start_file_watching", { path: rootPath });
            await message("Đã bật theo dõi thay đổi thời gian thực.", {
              title: "Thông báo",
              kind: "info",
            });
          } else {
            await invoke("stop_file_watching");
            await message("Đã tắt theo dõi thay đổi thời gian thực.", {
              title: "Thông báo",
              kind: "info",
            });
          }
        } catch (error) {
          console.error("Lỗi khi thay đổi trạng thái theo dõi file:", error);
          await message(
            `Không thể ${enabled ? "bật" : "tắt"} theo dõi: ${error}`,
            { title: "Lỗi", kind: "error" }
          );
          // Revert state nếu có lỗi
          set({ isWatchingFiles: !enabled });
        }
      },
      // --- THÊM LOGIC CHO ACTIONS MỚI ---
      exportProject: async () => {
        const { rootPath, activeProfile } = get();
        if (!rootPath || !activeProfile) return;
        await message("Bắt đầu xuất ngữ cảnh dự án...", {
          title: "Thông báo",
          kind: "info",
        });
        invoke("start_project_export", {
          path: rootPath,
          profileName: activeProfile,
        });
        // Listener sự kiện trong `useDashboard` sẽ xử lý kết quả
      },
      copyProjectToClipboard: async () => {
        const { rootPath, activeProfile } = get();
        if (!rootPath || !activeProfile) return;
        await message("Đang tạo ngữ cảnh để sao chép...", {
          title: "Thông báo",
          kind: "info",
        });
        try {
          const context = await invoke<string>("generate_project_context", {
            path: rootPath,
            profileName: activeProfile,
          });
          await writeText(context);
          await message("Đã sao chép ngữ cảnh dự án vào clipboard!", {
            title: "Thành công",
            kind: "info",
          });
        } catch (error) {
          console.error("Lỗi khi sao chép ngữ cảnh dự án:", error);
          await message(`Không thể sao chép: ${error}`, {
            title: "Lỗi",
            kind: "error",
          });
        }
      },
    },
  };
});

export const useAppActions = () => useAppStore((state) => state.actions);
