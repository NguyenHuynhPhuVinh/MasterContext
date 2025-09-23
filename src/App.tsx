// src/App.tsx
import { useEffect, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";
import { Menu, MenuItem, Submenu } from "@tauri-apps/api/menu";
import { save, message } from "@tauri-apps/plugin-dialog"; // <-- THAY ĐỔI IMPORT
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useAppStore, useAppActions } from "./store/appStore";
import { type GroupStats, type CachedProjectData } from "./store/types";
import { useShallow } from "zustand/react/shallow"; // <-- THÊM IMPORT NÀY
import { WelcomeScene } from "./scenes/WelcomeScene";
import { ScanningScene } from "./scenes/ScanningScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { SidebarPanel } from "./scenes/SidebarPanel";
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
  } = useAppStore(
    // --- SỬA LỖI TẠI ĐÂY ---
    useShallow((state) => ({
      selectedPath: state.selectedPath,
      activeScene: state.activeScene,
      isScanning: state.isScanning,
      projectStats: state.projectStats,
      isSidebarVisible: state.isSidebarVisible,
    }))
  );

  const {
    _setScanProgress,
    _setScanComplete,
    _setScanError,
    _setGroupUpdateComplete,
    rescanProject,
    openFolderFromMenu,
    showSettingsScene,
    exportProject,
    copyProjectToClipboard,
    toggleSidebarVisibility, // <-- Action mới
  } = useAppActions();

  // --- Effect áp dụng theme (giữ nguyên) ---
  useEffect(() => {
    const theme = localStorage.getItem("theme") || "light";
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, []);

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

        const fileSubmenu = await Submenu.new({
          text: "Tệp",
          items: [
            openFolderItem,
            rescanFolderItem,
            exportProjectItem,
            copyProjectItem,
          ],
        });

        // --- THÊM MENU CÀI ĐẶT ---
        const settingsItem = await MenuItem.new({
          id: "open_settings",
          text: "Cài đặt...",
          action: showSettingsScene,
        });

        // --- MENU MỚI ---
        const windowSubmenu = await Submenu.new({
          text: "Cửa sổ",
          items: [
            await MenuItem.new({
              id: "toggle_sidebar",
              text: "Bảng điều khiển",
              action: toggleSidebarVisibility,
            }),
          ],
        });

        const optionsSubmenu = await Submenu.new({
          text: "Tùy chọn",
          items: [settingsItem],
        });
        // --- KẾT THÚC THÊM MENU ---

        const appMenu = await Menu.new({
          items: [fileSubmenu, windowSubmenu, optionsSubmenu], // <-- Thêm menu mới vào đây
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
    selectedPath,
    isScanning, // <-- THÊM VÀO DEPENDENCY
    openFolderFromMenu,
    rescanProject,
    showSettingsScene,
    exportProject,
    copyProjectToClipboard,
    toggleSidebarVisibility,
  ]); // <-- Thêm dependency

  const throttledSetScanProgress = useMemo(
    () => throttle((file: string) => _setScanProgress(file), 10),
    [_setScanProgress]
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
      listen<CachedProjectData>("scan_complete", async (event) => {
        _setScanComplete(event.payload);
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
    _setScanComplete,
    _setScanError,
    throttledSetScanProgress,
    _setGroupUpdateComplete,
    rescanProject,
  ]);

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
            <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
              <SidebarPanel />
            </ResizablePanel>
          )}
          {isSidebarVisible && <ResizableHandle withHandle />}
          <ResizablePanel defaultSize={75}>
            <MainPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
        <StatusBar stats={projectStats} path={selectedPath} />
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
