// src/App.tsx
import { useEffect, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  Menu,
  MenuItem,
  Submenu,
  PredefinedMenuItem,
  CheckMenuItem,
} from "@tauri-apps/api/menu";
import { save, message } from "@tauri-apps/plugin-dialog"; // <-- THAY ĐỔI IMPORT
import { invoke } from "@tauri-apps/api/core";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { useAppStore, useAppActions } from "./store/appStore";
import {
  type GroupStats,
  type AppSettings,
  type ScanCompletePayload,
} from "./store/types";
import { useShallow } from "zustand/react/shallow"; // <-- THÊM IMPORT NÀY
import { WelcomeScene } from "./scenes/WelcomeScene";
import { ScanningScene } from "./scenes/ScanningScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { SidebarPanel } from "./scenes/SidebarPanel";
import { GitPanel } from "./components/GitPanel";
import { MainPanel } from "./scenes/MainPanel";
import { StatusBar } from "./components/StatusBar";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "./components/ui/resizable";
import { throttle } from "@/lib/utils";
import "./App.css";

function App() {
  const {
    selectedPath,
    activeScene,
    isScanning,
    projectStats,
    isSidebarVisible,
    isEditorPanelVisible,
    isGitPanelVisible,
    gitRepoInfo,
  } = useAppStore(
    // --- SỬA LỖI TẠI ĐÂY ---
    useShallow((state) => ({
      selectedPath: state.selectedPath,
      activeScene: state.activeScene,
      isScanning: state.isScanning,
      projectStats: state.projectStats,
      isSidebarVisible: state.isSidebarVisible,
      isGitPanelVisible: state.isGitPanelVisible,
      isEditorPanelVisible: state.isEditorPanelVisible,
      gitRepoInfo: state.gitRepoInfo,
    }))
  );

  const {
    _setScanProgress,
    _setAnalysisProgress,
    _setScanComplete,
    _setScanError,
    _setGroupUpdateComplete,
    rescanProject,
    openFolderFromMenu,
    showSettingsScene,
    exportProject,
    copyProjectToClipboard,
    toggleProjectPanelVisibility,
    toggleGitPanelVisibility,
    toggleEditorPanelVisibility,
    _setRecentPaths,
    updateAppSettings,
    reset,
  } = useAppActions();

  // --- Effect áp dụng theme (giữ nguyên) ---
  useEffect(() => {
    const theme = localStorage.getItem("theme") || "light";
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, []);

  // Load app settings on startup
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await invoke<AppSettings>("get_app_settings");
        // Cập nhật state một lần với tất cả cài đặt
        _setRecentPaths(settings.recentPaths ?? []);
        // Dùng set thay vì updateAppSettings để không ghi lại file
        useAppStore.setState({
          nonAnalyzableExtensions: settings.nonAnalyzableExtensions ?? [],
        });
      } catch (e) {
        console.error("Could not load app settings:", e);
      }
    };
    loadSettings();
  }, [_setRecentPaths]);

  // --- CẬP NHẬT LOGIC TẠO MENU ---
  // Effect này sẽ chạy mỗi khi `selectedPath` hoặc `isScanning` thay đổi
  useEffect(() => {
    const setupMenu = async () => {
      try {
        const openFolderItem = await MenuItem.new({
          id: "open_new_folder",
          text: "Mở thư mục mới...",
          action: openFolderFromMenu,
        });

        const rescanFolderItem = await MenuItem.new({
          id: "rescan_folder",
          text: "Quét lại thư mục",
          action: async () => {
            if (useAppStore.getState().selectedPath) {
              rescanProject();
            } else {
              await message("Vui lòng mở một dự án trước khi quét lại.", {
                title: "Thông báo",
                kind: "info",
              });
            }
          },
        });

        // --- TẠO CÁC MENU ITEM MỚI ---
        const exportProjectItem = await MenuItem.new({
          id: "export_project",
          text: "Xuất ngữ cảnh dự án...",
          action: exportProject,
        });

        const copyProjectItem = await MenuItem.new({
          id: "copy_project",
          text: "Sao chép ngữ cảnh dự án",
          action: copyProjectToClipboard,
        });

        const closeProjectItem = await MenuItem.new({
          id: "close_project",
          text: "Đóng dự án",
          action: reset,
        });

        const fileSubmenu = await Submenu.new({
          text: "Tệp",
          items: [
            openFolderItem,
            rescanFolderItem,
            exportProjectItem,
            copyProjectItem,
            await PredefinedMenuItem.new({ item: "Separator" }),
            closeProjectItem,
          ],
        });

        // --- MENU MỚI ---
        const windowSubmenu = await Submenu.new({
          text: "Cửa sổ",
          items: [
            await CheckMenuItem.new({
              id: "toggle_project_panel",
              text: "Bảng điều khiển Dự án",
              action: toggleProjectPanelVisibility,
              checked: isSidebarVisible,
            }),
            await CheckMenuItem.new({
              id: "toggle_git_panel",
              text: "Bảng điều khiển Git",
              action: toggleGitPanelVisibility,
              checked: isGitPanelVisible,
            }),
            await CheckMenuItem.new({
              id: "toggle_editor_panel",
              text: "Bảng điều khiển Editor",
              action: toggleEditorPanelVisibility,
              checked: isEditorPanelVisible,
            }),
          ],
        });

        const appMenu = await Menu.new({
          items: [fileSubmenu, windowSubmenu],
        });

        // Đặt menu cho cửa sổ hiện tại
        await appMenu.setAsAppMenu();
      } catch (error) {
        console.error("Failed to create application menu:", error);
        await message("Không thể khởi tạo menu ứng dụng.", {
          title: "Lỗi nghiêm trọng",
          kind: "error",
        });
      }
    };

    const clearMenu = async () => {
      try {
        // Tạo menu rỗng để gỡ bỏ menu
        const emptyMenu = await Menu.new({
          items: [],
        });
        await emptyMenu.setAsAppMenu();
      } catch (error) {
        console.error("Failed to clear application menu:", error);
      }
    };

    // Logic chính:
    // Nếu có selectedPath VÀ không đang quét, thì tạo menu
    if (selectedPath && !isScanning) {
      // <-- THAY ĐỔI ĐIỀU KIỆN TẠI ĐÂY
      setupMenu();
    } else {
      // Nếu không có (đang ở Welcome hoặc đang quét), thì gỡ menu
      clearMenu();
    }
  }, [
    // CẬP NHẬT DEPENDENCY ĐỂ MENU TỰ ĐỘNG CẬP NHẬT
    selectedPath,
    isScanning, // <-- THÊM VÀO DEPENDENCY
    isSidebarVisible,
    isGitPanelVisible,
    isEditorPanelVisible,
    openFolderFromMenu,
    rescanProject,
    showSettingsScene,
    exportProject,
    copyProjectToClipboard,
    toggleProjectPanelVisibility,
    toggleGitPanelVisibility,
    toggleEditorPanelVisibility,
    _setRecentPaths,
    reset,
  ]); // <-- Thêm dependency

  const throttledSetScanProgress = useMemo(
    () => throttle((file: string) => _setScanProgress(file), 10),
    [_setScanProgress]
  );
  const throttledSetAnalysisProgress = useMemo(
    () => throttle((file: string) => _setAnalysisProgress(file), 10),
    [_setAnalysisProgress]
  );

  // --- LẮNG NGHE SỰ KIỆN TỪ RUST ---
  useEffect(() => {
    const unlistenFuncs: Promise<() => void>[] = [];

    unlistenFuncs.push(
      listen<string>("scan_progress", (event) => {
        throttledSetScanProgress(event.payload);
      })
    );
    unlistenFuncs.push(
      listen<string>("analysis_progress", (event) => {
        throttledSetAnalysisProgress(event.payload);
      })
    );
    unlistenFuncs.push(
      listen<ScanCompletePayload>("scan_complete", async (event) => {
        const { projectData, isFirstScan } = event.payload;
        _setScanComplete(projectData);

        if (isFirstScan) {
          let permissionGranted = await isPermissionGranted();
          if (!permissionGranted) {
            const permission = await requestPermission();
            permissionGranted = permission === "granted";
          }
          if (permissionGranted) {
            sendNotification({
              title: "Quét lần đầu hoàn tất!",
              body: "Dữ liệu đã được lưu lại. Các lần quét sau cho dự án này sẽ nhanh hơn đáng kể.",
            });
          }
        }
      })
    );
    unlistenFuncs.push(
      listen<string>("scan_error", async (event) => {
        _setScanError(event.payload);
        await message(`Lỗi khi phân tích dự án: ${event.payload}`, {
          title: "Lỗi",
          kind: "error",
        });
      })
    );
    unlistenFuncs.push(
      listen<{ groupId: string; stats: GroupStats; paths: string[] }>(
        "group_update_complete",
        async (event) => {
          _setGroupUpdateComplete(event.payload);
        }
      )
    );
    unlistenFuncs.push(
      listen<string>("auto_sync_error", async (event) => {
        await message(`Lỗi đồng bộ: ${event.payload}`, {
          title: "Lỗi đồng bộ",
          kind: "error",
        });
      })
    );
    unlistenFuncs.push(
      listen<void>("file_change_detected", async () => {
        if (!useAppStore.getState().isScanning) {
          rescanProject();
        }
      })
    );
    // Listener cho sự kiện xuất dự án (để hiển thị toast)
    unlistenFuncs.push(
      listen<string>("project_export_complete", async (event) => {
        try {
          const filePath = await save({
            title: "Lưu Ngữ cảnh Dự án",
            defaultPath: "project_context.txt",
            filters: [{ name: "Text File", extensions: ["txt"] }],
          });
          if (filePath) {
            await writeTextFile(filePath, event.payload);
            await message(`Đã lưu file thành công!`, {
              title: "Thành công",
              kind: "info",
            });
          }
        } catch (error) {
          console.error("Lỗi khi lưu file ngữ cảnh dự án:", error);
          await message("Đã xảy ra lỗi khi lưu file.", {
            title: "Lỗi",
            kind: "error",
          });
        }
      })
    );
    unlistenFuncs.push(
      listen<string>("project_export_error", async (event) => {
        await message(`Lỗi khi xuất dự án: ${event.payload}`, {
          title: "Lỗi",
          kind: "error",
        });
      })
    );

    return () => {
      unlistenFuncs.forEach((unlisten) => {
        unlisten.then((f) => f());
      });
    };
  }, [
    _setScanProgress,
    _setAnalysisProgress,
    _setScanComplete,
    _setScanError,
    throttledSetScanProgress,
    throttledSetAnalysisProgress,
    _setGroupUpdateComplete,
    rescanProject,
    _setRecentPaths,
    updateAppSettings,
  ]); // <-- Thêm dependency

  const renderContent = () => {
    if (isScanning) {
      return <ScanningScene />;
    }
    if (!selectedPath) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <WelcomeScene />
        </div>
      );
    }

    if (activeScene === "settings") {
      return <SettingsScene />;
    }

    // --- RENDER LAYOUT MỚI ---
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {isSidebarVisible && (
            <>
              <ResizablePanel
                id="project-panel"
                order={1}
                defaultSize={25}
                minSize={20}
                maxSize={40}
              >
                <SidebarPanel />
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}
          {isGitPanelVisible && (
            <>
              <ResizablePanel
                id="git-panel"
                order={2}
                defaultSize={25}
                minSize={20}
                maxSize={40}
              >
                <GitPanel />
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}
          {/* Nếu không có panel nào hiển thị, ẩn handle đi */}
          {!isSidebarVisible && !isGitPanelVisible && (
            <style>{`[data-slot="resizable-handle"] { display: none; }`}</style>
          )}
          <ResizablePanel id="main-panel" order={3} defaultSize={75}>
            <MainPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
        <StatusBar
          stats={projectStats}
          path={selectedPath}
          gitRepoInfo={gitRepoInfo}
          onShowSettings={showSettingsScene}
        />
      </div>
    );
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground">
      {/* <Toaster richColors /> XÓA DÒNG NÀY */}
      {renderContent()}
    </div>
  );
}

export default App;
