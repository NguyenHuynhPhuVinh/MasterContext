// src/App.tsx
import { useEffect, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";
import { Menu, MenuItem, Submenu } from "@tauri-apps/api/menu";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { Toaster, toast } from "sonner";
import { useAppStore, useAppActions } from "./store/appStore";
import { type GroupStats, type CachedProjectData } from "./store/types";
import { WelcomeScene } from "./scenes/WelcomeScene";
import { DashboardScene } from "./scenes/DashboardScene";
import { GroupEditorScene } from "./scenes/GroupEditorScene";
import { ScanningScene } from "./scenes/ScanningScene";
import { SettingsScene } from "./scenes/SettingsScene"; // <-- THÊM IMPORT
import { throttle } from "@/lib/utils";
import "./App.css";

function App() {
  const selectedPath = useAppStore((state) => state.selectedPath);
  const activeScene = useAppStore((state) => state.activeScene);
  const isScanning = useAppStore((state) => state.isScanning);
  const {
    _setScanProgress,
    _setScanComplete,
    _setScanError,
    _setGroupUpdateComplete,
    rescanProject,
    openFolderFromMenu,
    showSettingsScene,
    exportProject, // <-- Lấy action mới
    copyProjectToClipboard, // <-- Lấy action mới
  } = useAppActions();

  // --- Effect áp dụng theme (giữ nguyên) ---
  useEffect(() => {
    const theme = localStorage.getItem("theme") || "light";
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, []);

  // --- CẬP NHẬT LOGIC TẠO MENU ---
  // Effect này sẽ chạy mỗi khi `selectedPath` thay đổi
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
          action: () => {
            if (useAppStore.getState().selectedPath) {
              rescanProject();
            } else {
              toast.info("Vui lòng mở một dự án trước khi quét lại.");
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

        const optionsSubmenu = await Submenu.new({
          text: "Tùy chọn",
          items: [settingsItem],
        });
        // --- KẾT THÚC THÊM MENU ---

        const appMenu = await Menu.new({
          items: [fileSubmenu, optionsSubmenu], // <-- Thêm menu mới vào đây
        });

        // Đặt menu cho cửa sổ hiện tại
        await appMenu.setAsAppMenu();
      } catch (error) {
        console.error("Failed to create application menu:", error);
        toast.error("Không thể khởi tạo menu ứng dụng.");
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
    // Nếu có selectedPath (đang ở Dashboard), thì tạo menu
    if (selectedPath) {
      setupMenu();
    } else {
      // Nếu không có (đang ở Welcome), thì gỡ menu
      clearMenu();
    }
  }, [
    selectedPath,
    openFolderFromMenu,
    rescanProject,
    showSettingsScene,
    exportProject,
    copyProjectToClipboard,
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
      listen<CachedProjectData>("scan_complete", (event) => {
        _setScanComplete(event.payload);
        toast.success("Phân tích dự án hoàn tất!");
      })
    );
    unlistenFuncs.push(
      listen<string>("scan_error", (event) => {
        _setScanError(event.payload);
        toast.error(`Lỗi khi phân tích dự án: ${event.payload}`);
      })
    );
    unlistenFuncs.push(
      listen<{ groupId: string; stats: GroupStats; paths: string[] }>(
        "group_update_complete",
        (event) => {
          _setGroupUpdateComplete(event.payload);
          toast.success("Lưu nhóm thành công!");
        }
      )
    );
    unlistenFuncs.push(
      listen<string>("auto_sync_started", (event) => {
        toast.info(event.payload);
      })
    );
    unlistenFuncs.push(
      listen<string>("auto_sync_complete", (event) => {
        toast.success(event.payload);
      })
    );
    unlistenFuncs.push(
      listen<string>("auto_sync_error", (event) => {
        toast.error(`Lỗi đồng bộ: ${event.payload}`);
      })
    );
    unlistenFuncs.push(
      listen<void>("file_change_detected", () => {
        if (!useAppStore.getState().isScanning) {
          toast.info("Phát hiện thay đổi, bắt đầu quét lại dự án...");
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
            toast.success(`Đã lưu file thành công!`);
          }
        } catch (error) {
          console.error("Lỗi khi lưu file ngữ cảnh dự án:", error);
          toast.error("Đã xảy ra lỗi khi lưu file.");
        }
      })
    );
    unlistenFuncs.push(
      listen<string>("project_export_error", (event) => {
        toast.error(`Lỗi khi xuất dự án: ${event.payload}`);
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
    switch (activeScene) {
      case "groupEditor":
        return <GroupEditorScene />;
      case "settings": // <-- THÊM CASE MỚI
        return <SettingsScene />;
      case "dashboard":
      default:
        return <DashboardScene />;
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground">
      <Toaster richColors />
      {renderContent()}
    </div>
  );
}

export default App;
