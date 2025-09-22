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
      updateGroupPaths: async (groupId, paths) => {
        const rootPath = get().rootPath;
        if (!rootPath) return;
        set({ isUpdatingGroupId: groupId });
        // === BẮT ĐẦU SỬA LỖI ===
        // Lệnh invoke giờ không cần app_handle nữa
        await invoke("start_group_update", {
          groupId,
          rootPathStr: rootPath,
          paths,
        });
        // === KẾT THÚC SỬA LỖI ===
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
        // <<< DEBUG LOG 5 >>>
        console.log(
          `[STORE] UPDATE COMPLETE: Nhận được từ Rust cho nhóm '${groupId}'.`
        );
        console.log("[STORE] UPDATE COMPLETE: Paths mới:", paths);
        console.log("[STORE] UPDATE COMPLETE: Stats mới:", stats);

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
        // <<< DEBUG LOG 1 >>>
        console.log(
          `[STORE] TOGGLE: Node='${toggledNode.path}', Selected=${isSelected}`
        );

        set((state) => {
          if (!state.tempSelectedPaths) return {};

          const newSelectedPaths = new Set(state.tempSelectedPaths);
          const pathsToToggle = getDescendantAndSelfPaths(toggledNode);

          if (isSelected) {
            // Thêm mục được chọn và tất cả các con của nó
            pathsToToggle.forEach((p) => newSelectedPaths.add(p));

            // *** PHẦN SỬA LỖI QUAN TRỌNG NHẤT ***
            // Thêm tất cả các thư mục cha ngược lên đến gốc
            // để đảm bảo logic duyệt cây không bị dừng sớm.
            let parentPath = toggledNode.path;
            while (parentPath.lastIndexOf("/") > -1) {
              parentPath = parentPath.substring(0, parentPath.lastIndexOf("/"));
              newSelectedPaths.add(parentPath);
            }
            // Luôn đảm bảo có đường dẫn gốc ""
            newSelectedPaths.add("");
          } else {
            // Xóa mục được chọn và tất cả các con của nó
            pathsToToggle.forEach((p) => newSelectedPaths.delete(p));

            // Tùy chọn: Dọn dẹp các thư mục cha nếu chúng không còn con nào được chọn
            // (Hiện tại có thể bỏ qua để giữ logic đơn giản, việc xóa đã hoạt động đúng)
          }

          // <<< DEBUG LOG 2 >>>
          console.log(
            `[STORE] tempSelectedPaths CÓ ${newSelectedPaths.size} MỤC`
          );

          return { tempSelectedPaths: newSelectedPaths };
        });
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

        // <<< DEBUG LOG 3 >>>
        console.log(`[STORE] SAVE: Bắt đầu lưu nhóm '${editingGroupId}'.`);
        console.log(
          `[STORE] SAVE: tempSelectedPaths hiện có ${tempSelectedPaths?.size} mục.`
        );

        if (editingGroupId && tempSelectedPaths && fileTree) {
          // 1. Prune the expanded UI paths back to a minimal set for saving
          const pathsToSave = prunePathsForSave(fileTree, tempSelectedPaths);

          // <<< DEBUG LOG 4 (QUAN TRỌNG NHẤT) >>>
          // Đây là dữ liệu thực sự được gửi đến Rust để lưu.
          console.log(
            '[STORE] SAVE: Dữ liệu sau khi "prune" để lưu:',
            pathsToSave
          );

          // 2. Call the async update action
          await get().actions.updateGroupPaths(editingGroupId, pathsToSave);

          // 3. Clean up and navigate back - sẽ được xử lý bởi _setGroupUpdateComplete
        }
      },
    },
  };
});

export const useAppActions = () => useAppStore((state) => state.actions);
