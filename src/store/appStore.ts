// src/store/appStore.ts
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
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
  fileMetadataCache: Record<string, FileMetadata> | null; // <-- THÊM STATE NÀY
  isCrossLinkingEnabled: boolean; // <-- THÊM STATE NÀY
  // --- STATE MỚI CHO CÀI ĐẶT ĐỒNG BỘ ---
  syncEnabled: boolean;
  syncPath: string | null;

  actions: {
    selectRootPath: (path: string) => Promise<void>; // <-- Chuyển thành async
    // --- THÊM MỚI: Action để quét lại dự án ---
    rescanProject: () => Promise<void>;
    reset: () => void;
    addGroup: (group: Omit<Group, "id" | "paths" | "stats">) => void;
    updateGroup: (group: Omit<Group, "paths" | "stats">) => void;
    deleteGroup: (groupId: string) => void;
    // --- ACTIONS MỚI ---
    editGroupContent: (groupId: string) => void;
    showDashboard: () => void;
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
  };
}

export const useAppStore = create<AppState>((set, get) => {
  // --- PHẦN MỚI: Hàm trợ giúp để cập nhật groups trên backend ---
  const updateGroupsOnBackend = async () => {
    const { rootPath, groups } = get();
    if (rootPath) {
      try {
        // === BẮT ĐẦU SỬA LỖI ===
        // Lệnh invoke giờ không cần app_handle nữa
        await invoke("update_groups_in_project_data", {
          path: rootPath,
          groups: groups,
        });
        // === KẾT THÚC SỬA LỖI ===
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
    actions: {
      // --- CẬP NHẬT selectRootPath ---
      selectRootPath: async (path) => {
        // 1. Cập nhật state UI ngay lập tức để hiển thị màn hình Scanning
        set({
          isScanning: true,
          rootPath: path,
          selectedPath: path,
          projectStats: null,
          fileTree: null,
          groups: [],
          activeScene: "dashboard", // Vẫn giữ để sau khi quét xong sẽ vào dashboard
          scanProgress: { currentFile: "Đang khởi tạo quá trình quét..." },
        });

        // 2. Kích hoạt quá trình quét ở backend
        try {
          // === THAY ĐỔI QUAN TRỌNG: XÓA `await` ===
          // Frontend chỉ cần ra lệnh cho backend bắt đầu, không cần chờ nó xong.
          // Kết quả sẽ được xử lý bởi listener sự kiện trong `App.tsx`.
          invoke("open_project", { path });
        } catch (error) {
          console.error("Lỗi khi gọi command open_project:", error);
          // Nếu việc `invoke` thất bại ngay lập tức (hiếm), chúng ta vẫn xử lý lỗi
          set({ isScanning: false });
          alert("Không thể bắt đầu phân tích dự án.");
        }
      },
      // --- THÊM MỚI: Logic cho action rescanProject ---
      rescanProject: async () => {
        const { rootPath } = get();
        if (!rootPath) {
          console.warn("Không thể quét lại vì chưa có dự án nào được chọn.");
          return;
        }
        // 1. Đặt trạng thái đang quét
        set({
          isScanning: true,
          scanProgress: { currentFile: "Bắt đầu quét lại dự án..." },
        });
        // 2. Gọi lại command 'open_project' với đường dẫn hiện tại
        try {
          invoke("open_project", { path: rootPath });
        } catch (error) {
          console.error("Lỗi khi bắt đầu quét lại dự án:", error);
          set({
            isScanning: false,
            scanProgress: { currentFile: null },
          });
          alert("Không thể bắt đầu quá trình quét lại dự án.");
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
          crossSyncEnabled: false, // <-- GÁN GIÁ TRỊ MẶC ĐỊNH
        };
        set((state) => ({ groups: [...state.groups, groupWithDefaults] }));
        updateGroupsOnBackend(); // <-- GỌI HÀM MỚI
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
      updateGroupPaths: (groupId, paths) => {
        // Không cần async nữa
        const rootPath = get().rootPath;
        if (!rootPath) return;
        set({ isUpdatingGroupId: groupId });

        // Chỉ "bắn" lệnh đi và không chờ đợi
        invoke("start_group_update", {
          groupId,
          rootPathStr: rootPath,
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
          })),
          isScanning: false,
          // Cập nhật cài đặt đồng bộ từ file đã tải
          syncEnabled: payload.sync_enabled ?? false,
          syncPath: payload.sync_path ?? null,
          // file_metadata_cache được backend quản lý, frontend không cần lưu
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
        const rootPath = get().rootPath;
        if (!rootPath) return;

        // Cập nhật state ở frontend ngay lập tức
        set({ syncEnabled: enabled, syncPath: path });

        // Gọi backend để lưu cài đặt
        try {
          await invoke("update_sync_settings", {
            path: rootPath,
            enabled,
            syncPath: path,
          });
        } catch (error) {
          console.error("Lỗi khi lưu cài đặt đồng bộ:", error);
          alert("Không thể lưu cài đặt đồng bộ.");
        }
      },

      // --- ACTION MỚI ĐỂ BẬT/TẮT SWITCH ---
      setGroupCrossSync: async (groupId, enabled) => {
        const rootPath = get().rootPath;
        if (!rootPath) return;

        // Cập nhật UI ngay lập tức
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === groupId ? { ...g, crossSyncEnabled: enabled } : g
          ),
        }));

        // Gọi backend để lưu lại
        try {
          await invoke("set_group_cross_sync", {
            path: rootPath,
            groupId,
            enabled,
          });
        } catch (error) {
          console.error("Lỗi khi cập nhật cài đặt đồng bộ chéo:", error);
          // Optional: revert state nếu có lỗi
          set((state) => ({
            groups: state.groups.map((g) =>
              g.id === groupId ? { ...g, crossSyncEnabled: !enabled } : g
            ),
          }));
        }
      },
    },
  };
});

export const useAppActions = () => useAppStore((state) => state.actions);
