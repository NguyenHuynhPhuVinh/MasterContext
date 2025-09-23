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
  allGroups: Map<string, Group[]>;
  groups: Group[]; // Derived state

  // Dữ liệu quét chung
  projectStats: ProjectStats | null;
  fileTree: FileNode | null;
  fileMetadataCache: Record<string, FileMetadata> | null;

  // State giao diện
  activeScene: "dashboard" | "settings";
  editingGroupId: string | null;
  isScanning: boolean;
  scanProgress: ScanProgress;
  isUpdatingGroupId: string | null;
  tempSelectedPaths: Set<string> | null;
  isCrossLinkingEnabled: boolean;

  // Dữ liệu riêng của hồ sơ active
  syncEnabled: boolean;
  syncPath: string | null;
  customIgnorePatterns: string[];
  isWatchingFiles: boolean;
  exportUseFullTree: boolean; // <-- THÊM STATE MỚI

  // Quản lý hồ sơ
  profiles: string[];
  activeProfile: string;
  isSidebarVisible: boolean;

  actions: {
    selectRootPath: (path: string) => Promise<void>;
    openFolderFromMenu: () => Promise<void>;
    rescanProject: () => Promise<void>;
    reset: () => void;
    addGroup: (group: Omit<Group, "id" | "paths" | "stats">) => void;
    updateGroup: (group: Omit<Group, "paths" | "stats">) => void;
    deleteGroup: (groupId: string) => void;
    editGroupContent: (groupId: string) => void;
    showDashboard: () => void;
    showSettingsScene: () => void;
    updateGroupPaths: (groupId: string, paths: string[]) => void;
    _setScanProgress: (file: string) => void;
    _setScanComplete: (payload: CachedProjectData) => void;
    _setScanError: (error: string) => void;
    _setGroupUpdateComplete: (payload: {
      groupId: string;
      stats: GroupStats;
      paths: string[];
    }) => void;
    startEditingGroup: (groupId: string) => void;
    toggleEditingPath: (node: FileNode, isSelected: boolean) => void;
    cancelEditingGroup: () => void;
    saveEditingGroup: () => Promise<void>;
    setCrossLinkingEnabled: (enabled: boolean) => void;
    selectAllFiles: () => void;
    deselectAllFiles: () => void;
    setSyncSettings: (settings: {
      enabled: boolean;
      path: string | null;
    }) => Promise<void>;
    setGroupCrossSync: (groupId: string, enabled: boolean) => Promise<void>;
    setCustomIgnorePatterns: (patterns: string[]) => Promise<void>;
    switchProfile: (profileName: string) => Promise<void>;
    createProfile: (profileName: string) => Promise<void>;
    renameProfile: (oldName: string, newName: string) => Promise<void>;
    deleteProfile: (profileName: string) => Promise<void>;
    setFileWatching: (enabled: boolean) => Promise<void>;
    setExportUseFullTree: (enabled: boolean) => Promise<void>; // <-- THÊM ACTION MỚI
    exportProject: () => void;
    copyProjectToClipboard: () => Promise<void>;
    toggleSidebarVisibility: () => void;
  };
}

export const useAppStore = create<AppState>((set, get) => {
  // --- PHẦN MỚI: Hàm trợ giúp để cập nhật groups trên backend ---
  const updateGroupsOnBackend = async () => {
    const { rootPath, allGroups, activeProfile } = get();
    const activeGroups = allGroups.get(activeProfile) || [];
    if (rootPath) {
      try {
        await invoke("update_groups_in_project_data", {
          path: rootPath,
          profileName: activeProfile,
          groups: activeGroups,
        });
      } catch (error) {
        console.error("Lỗi khi cập nhật nhóm trên backend:", error);
      }
    }
  };

  return {
    rootPath: null,
    selectedPath: null,
    allGroups: new Map(),
    groups: [],
    projectStats: null,
    fileTree: null,
    fileMetadataCache: null,
    activeScene: "dashboard",
    editingGroupId: null,
    isScanning: false,
    scanProgress: { currentFile: null },
    isUpdatingGroupId: null,
    tempSelectedPaths: null,
    isCrossLinkingEnabled: false,
    syncEnabled: false,
    syncPath: null,
    customIgnorePatterns: [],
    isWatchingFiles: false,
    exportUseFullTree: false, // <-- Thêm giá trị mặc định
    profiles: ["default"],
    activeProfile: "default",
    isSidebarVisible: true,
    actions: {
      selectRootPath: async (path) => {
        set({
          rootPath: path,
          selectedPath: path,
          isScanning: true,
          scanProgress: { currentFile: "Bắt đầu quét dự án..." },
        });

        // Luôn quét profile 'default' khi mở một thư mục mới
        invoke("scan_project", { path, profileName: "default" });

        // Sau khi quét xong (trong _setScanComplete), chúng ta sẽ tải các profile khác
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

      rescanProject: async () => {
        const { rootPath, activeProfile } = get();
        if (!rootPath) return;
        set({
          isScanning: true,
          scanProgress: { currentFile: "Quét lại dự án..." },
        });
        invoke("scan_project", { path: rootPath, profileName: activeProfile });
      },
      reset: () =>
        set({
          rootPath: null,
          selectedPath: null,
          allGroups: new Map(),
          groups: [],
          activeScene: "dashboard",
          editingGroupId: null,
          profiles: ["default"],
          activeProfile: "default",
        }),

      // --- CẬP NHẬT: addGroup không còn đổi scene nữa ---
      addGroup: (newGroup) => {
        const groupWithDefaults: Group = {
          ...newGroup,
          id: Date.now().toString(),
          paths: [],
          stats: defaultGroupStats(),
          crossSyncEnabled: false,
          tokenLimit: newGroup.tokenLimit || undefined,
        };
        // THAY ĐỔI LỚN 4: Cập nhật allGroups thay vì groups
        set((state) => {
          const newAllGroups = new Map(state.allGroups);
          const currentGroups = newAllGroups.get(state.activeProfile) || [];
          newAllGroups.set(state.activeProfile, [
            ...currentGroups,
            groupWithDefaults,
          ]);
          return {
            allGroups: newAllGroups,
            groups: newAllGroups.get(state.activeProfile) || [],
            editingGroupId: groupWithDefaults.id,
          };
        });
        get().actions.startEditingGroup(groupWithDefaults.id);
        updateGroupsOnBackend();
      },
      updateGroup: (updatedGroup) => {
        set((state) => {
          const newAllGroups = new Map(state.allGroups);
          const currentGroups = newAllGroups.get(state.activeProfile) || [];
          const updatedGroups = currentGroups.map((g) =>
            g.id === updatedGroup.id ? { ...g, ...updatedGroup } : g
          );
          newAllGroups.set(state.activeProfile, updatedGroups);
          return {
            allGroups: newAllGroups,
            groups: updatedGroups,
          };
        });
        updateGroupsOnBackend();
      },
      deleteGroup: (groupId) => {
        set((state) => {
          const newAllGroups = new Map(state.allGroups);
          const currentGroups = newAllGroups.get(state.activeProfile) || [];
          const updatedGroups = currentGroups.filter((g) => g.id !== groupId);
          newAllGroups.set(state.activeProfile, updatedGroups);
          return {
            allGroups: newAllGroups,
            groups: updatedGroups,
            editingGroupId:
              state.editingGroupId === groupId ? null : state.editingGroupId,
          };
        });
        updateGroupsOnBackend();
      },

      // --- CÁC ACTION MỚI ---
      editGroupContent: (groupId) => {
        get().actions.startEditingGroup(groupId);
        set({ editingGroupId: groupId });
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
      _setScanComplete: async (payload: CachedProjectData) => {
        const { rootPath, activeProfile } = get();

        // 1. Lưu trữ dữ liệu quét chung
        set({
          projectStats: payload.stats,
          fileTree: payload.file_tree,
          fileMetadataCache: payload.file_metadata_cache,
          isScanning: false,
        });

        // 2. Cập nhật dữ liệu cho hồ sơ vừa được quét
        const loadedGroups = (payload.groups || []).map((g) => ({ ...g }));
        set((state) => {
          const newAllGroups = new Map(state.allGroups);
          newAllGroups.set(activeProfile, loadedGroups);
          return {
            allGroups: newAllGroups,
            groups: loadedGroups,
            syncEnabled: payload.sync_enabled ?? false,
            syncPath: payload.sync_path ?? null,
            customIgnorePatterns: payload.custom_ignore_patterns ?? [],
            isWatchingFiles: payload.is_watching_files ?? false,
            exportUseFullTree: payload.export_use_full_tree ?? false, // <-- Tải cài đặt mới
          };
        });

        // 3. Tải (nhưng không quét) các hồ sơ còn lại
        if (rootPath) {
          try {
            const profiles = await invoke<string[]>("list_profiles", {
              projectPath: rootPath,
            });
            set({ profiles });

            const otherProfiles = profiles.filter((p) => p !== activeProfile);
            const groupPromises = otherProfiles.map((p) =>
              invoke<Group[]>("list_groups_for_profile", {
                projectPath: rootPath,
                profileName: p,
              }).then((groups) => [p, groups] as [string, Group[]])
            );

            const otherProfileGroups = await Promise.all(groupPromises);
            set((state) => {
              const newAllGroups = new Map(state.allGroups);
              otherProfileGroups.forEach(([profileName, groups]) => {
                newAllGroups.set(profileName, groups);
              });
              return { allGroups: newAllGroups };
            });
          } catch (e) {
            console.error("Không thể tải danh sách các hồ sơ khác:", e);
          }
        }
      },
      _setScanError: (error) => {
        console.error("Scan error from Rust:", error);
        // Alert/toast đã được xử lý ở App.tsx, ở đây chỉ cần cập nhật state
        set({ isScanning: false });
      },
      // --- ACTIONS MỚI ---
      _setGroupUpdateComplete: ({ groupId, stats, paths }) => {
        set((state) => {
          const newAllGroups = new Map(state.allGroups);
          const currentGroups = newAllGroups.get(state.activeProfile) || [];
          const updatedGroups = currentGroups.map((g) =>
            g.id === groupId ? { ...g, paths: paths, stats: stats } : g
          );
          newAllGroups.set(state.activeProfile, updatedGroups);
          return {
            allGroups: newAllGroups,
            groups: updatedGroups,
            isUpdatingGroupId: null,
          };
        });
        get().actions.cancelEditingGroup();
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
        const { rootPath, activeProfile } = get();
        if (!rootPath) return;

        set((state) => {
          const newAllGroups = new Map(state.allGroups);
          const currentGroups = newAllGroups.get(activeProfile) || [];
          const updatedGroups = currentGroups.map((g) =>
            g.id === groupId ? { ...g, crossSyncEnabled: enabled } : g
          );
          newAllGroups.set(activeProfile, updatedGroups);
          return {
            allGroups: newAllGroups,
            groups: updatedGroups,
          };
        });

        try {
          await invoke("set_group_cross_sync", {
            path: rootPath,
            profileName: activeProfile,
            groupId,
            enabled,
          });
        } catch (error) {
          message(`Không thể cập nhật đồng bộ chéo: ${error}`, {
            title: "Lỗi",
            kind: "error",
          });
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
      switchProfile: async (profileName: string) => {
        const { rootPath, activeProfile, fileTree } = get();
        if (!rootPath || profileName === activeProfile) return;

        // Nếu chưa có dữ liệu quét chung, không làm gì cả
        if (!fileTree) return;

        // Reset lại Main Panel về trạng thái mặc định
        set({
          editingGroupId: null,
          scanProgress: { currentFile: `Đang tải ${profileName}...` },
        });
        try {
          // Chỉ gọi command để tải dữ liệu, không quét lại
          const profileData = await invoke<CachedProjectData>(
            "load_profile_data",
            {
              projectPath: rootPath,
              profileName: profileName,
            }
          );

          // Cập nhật state với dữ liệu của hồ sơ mới
          const loadedGroups = (profileData.groups || []).map((g) => ({
            ...g,
          }));
          set((state) => {
            const newAllGroups = new Map(state.allGroups);
            newAllGroups.set(profileName, loadedGroups);
            return {
              allGroups: newAllGroups,
              groups: loadedGroups,
              activeProfile: profileName,
              syncEnabled: profileData.sync_enabled ?? false,
              syncPath: profileData.sync_path ?? null,
              customIgnorePatterns: profileData.custom_ignore_patterns ?? [],
              isWatchingFiles: profileData.is_watching_files ?? false,
              exportUseFullTree: profileData.export_use_full_tree ?? false, // <-- Tải cài đặt mới
              scanProgress: { currentFile: null },
            };
          });
        } catch (error) {
          message(`Không thể tải hồ sơ ${profileName}: ${error}`, {
            title: "Lỗi",
            kind: "error",
          });
          set({ scanProgress: { currentFile: null } });
        }
      },
      createProfile: async (profileName: string) => {
        const { rootPath, profiles } = get();
        if (!rootPath || profiles.includes(profileName)) {
          message("Tên hồ sơ đã tồn tại.", { title: "Lỗi", kind: "error" });
          return;
        }
        try {
          // 1. Gọi command `clone_profile` mới, nhân bản từ "default"
          await invoke("clone_profile", {
            projectPath: rootPath,
            sourceProfileName: "default",
            newProfileName: profileName,
          });

          // 2. Cập nhật state ở frontend mà không cần quét lại
          set((state) => {
            const newAllGroups = new Map(state.allGroups);
            newAllGroups.set(profileName, []); // Hồ sơ mới có danh sách nhóm rỗng
            return {
              profiles: [...state.profiles, profileName],
              allGroups: newAllGroups,
            };
          });

          // 3. Kích hoạt hồ sơ mới để tải dữ liệu đã clone vào state
          //    Lưu ý: Thao tác này giờ sẽ rất nhanh vì dữ liệu đã có sẵn.
          get().actions.switchProfile(profileName);
        } catch (error) {
          message(`Không thể tạo hồ sơ: ${error}`, {
            title: "Lỗi",
            kind: "error",
          });
        }
      },
      // --- SỬA LỖI TẠI ĐÂY ---
      renameProfile: async (oldName: string, newName: string) => {
        const { rootPath, profiles } = get();
        if (!rootPath || profiles.includes(newName)) {
          message("Tên hồ sơ mới đã tồn tại.", { title: "Lỗi", kind: "error" });
          return;
        }
        try {
          await invoke("rename_profile", {
            projectPath: rootPath,
            oldName,
            newName,
          });
          set((state) => {
            const newAllGroups = new Map(state.allGroups);
            if (newAllGroups.has(oldName)) {
              newAllGroups.set(newName, newAllGroups.get(oldName)!);
              newAllGroups.delete(oldName);
            }
            return {
              profiles: state.profiles.map((p) =>
                p === oldName ? newName : p
              ),
              // Logic mới: Chỉ cập nhật activeProfile nếu hồ sơ được đổi tên là hồ sơ đang hoạt động
              activeProfile:
                state.activeProfile === oldName ? newName : state.activeProfile,
              allGroups: newAllGroups,
            };
          });
        } catch (error) {
          message(`Không thể đổi tên hồ sơ: ${error}`, {
            title: "Lỗi",
            kind: "error",
          });
        }
      },
      // --- KẾT THÚC SỬA LỖI ---
      deleteProfile: async (profileName: string) => {
        const { rootPath } = get();
        if (!rootPath || profileName === "default") return;
        try {
          await invoke("delete_profile", {
            projectPath: rootPath,
            profileName,
          });
          set((state) => {
            const newAllGroups = new Map(state.allGroups);
            newAllGroups.delete(profileName);
            return {
              profiles: state.profiles.filter((p) => p !== profileName),
              allGroups: newAllGroups,
            };
          });
          get().actions.switchProfile("default");
        } catch (error) {
          message(`Không thể xóa hồ sơ: ${error}`, {
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
          } else {
            await invoke("stop_file_watching");
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
      // --- ACTION MỚI ĐỂ LƯU CÀI ĐẶT XUẤT FILE ---
      setExportUseFullTree: async (enabled: boolean) => {
        const { rootPath, activeProfile } = get();
        if (!rootPath) return;

        set({ exportUseFullTree: enabled }); // Cập nhật UI ngay lập tức

        try {
          await invoke("set_export_use_full_tree_setting", {
            path: rootPath,
            profileName: activeProfile,
            enabled,
          });
        } catch (error) {
          message(`Không thể lưu cài đặt xuất file: ${error}`, {
            title: "Lỗi",
            kind: "error",
          });
          set((state) => ({ exportUseFullTree: !state.exportUseFullTree })); // Hoàn tác nếu lỗi
        }
      },
      // --- THÊM LOGIC CHO ACTIONS MỚI ---
      exportProject: async () => {
        const { rootPath, activeProfile } = get();
        if (!rootPath || !activeProfile) return;
        invoke("start_project_export", {
          path: rootPath,
          profileName: activeProfile,
        });
        // Listener sự kiện trong `useDashboard` sẽ xử lý kết quả
      },
      copyProjectToClipboard: async () => {
        const { rootPath, activeProfile } = get();
        if (!rootPath || !activeProfile) return;
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

      // --- ACTION MỚI ĐỂ BẬT/TẮT SIDEBAR ---
      toggleSidebarVisibility: () => {
        set((state) => ({ isSidebarVisible: !state.isSidebarVisible }));
      },
    },
  };
});

export const useAppActions = () => useAppStore((state) => state.actions);
