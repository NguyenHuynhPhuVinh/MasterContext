// src/App.tsx
import { useEffect, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";
import { Toaster, toast } from "sonner"; // <-- THÊM IMPORT
import { useAppStore, useAppActions } from "./store/appStore";
import { type GroupStats, type CachedProjectData } from "./store/types";
import { WelcomeScene } from "./scenes/WelcomeScene";
import { DashboardScene } from "./scenes/DashboardScene";
import { GroupEditorScene } from "./scenes/GroupEditorScene";
import { ScanningScene } from "./scenes/ScanningScene";
import { throttle } from "@/lib/utils"; // <-- Import hàm throttle
import "./App.css";

function App() {
  const selectedPath = useAppStore((state) => state.selectedPath);
  const activeScene = useAppStore((state) => state.activeScene);
  const isScanning = useAppStore((state) => state.isScanning); // <-- Lấy state isScanning
  const {
    _setScanProgress,
    _setScanComplete,
    _setScanError,
    _setGroupUpdateComplete,
    rescanProject, // <-- Lấy action rescanProject
  } = useAppActions();

  // --- THÊM MỚI: Logic áp dụng theme khi ứng dụng khởi động ---
  useEffect(() => {
    // Đọc theme từ localStorage, nếu không có thì mặc định là 'light'
    const theme = localStorage.getItem("theme") || "light";
    const root = window.document.documentElement;

    // Xóa các class cũ để đảm bảo sạch sẽ
    root.classList.remove("light", "dark");

    // Thêm class theme hiện tại vào thẻ <html>
    root.classList.add(theme);
  }, []); // Mảng rỗng `[]` đảm bảo effect này chỉ chạy một lần khi App được mount

  // --- THAY ĐỔI: Tạo một phiên bản throttled của hàm cập nhật ---
  const throttledSetScanProgress = useMemo(
    () => throttle((file: string) => _setScanProgress(file), 10), // Cập nhật tối đa 100 lần/giây (1000ms / 10ms)
    [_setScanProgress]
  );

  // --- LẮNG NGHE SỰ KIỆN TỪ RUST ---
  useEffect(() => {
    const unlistenFuncs: Promise<() => void>[] = [];

    // --- THAY ĐỔI: Sử dụng hàm đã được throttle ---
    unlistenFuncs.push(
      listen<string>("scan_progress", (event) => {
        throttledSetScanProgress(event.payload);
      })
    );

    unlistenFuncs.push(
      // --- SỬA LỖI: SỬA KIỂU DỮ LIỆU TỪ ProjectStats THÀNH CachedProjectData ---
      listen<CachedProjectData>("scan_complete", (event) => {
        _setScanComplete(event.payload);
        toast.success("Phân tích dự án hoàn tất!"); // <-- THÊM TOAST
        // --- ĐÃ XÓA LỆNH GỌI GÂY LẶP. Logic này giờ được xử lý hoàn toàn trong Rust. ---
      })
    );

    unlistenFuncs.push(
      listen<string>("scan_error", (event) => {
        _setScanError(event.payload);
        toast.error(`Lỗi khi phân tích dự án: ${event.payload}`); // <-- THÊM TOAST
      })
    );

    // Thêm listener cho group_update_complete
    unlistenFuncs.push(
      // --- THAY ĐỔI: Thêm `paths` vào payload ---
      listen<{ groupId: string; stats: GroupStats; paths: string[] }>(
        "group_update_complete",
        (event) => {
          _setGroupUpdateComplete(event.payload);
          toast.success("Lưu nhóm thành công!"); // <-- THÊM TOAST
        }
      )
    );

    // Thêm listener cho các sự kiện đồng bộ tự động
    unlistenFuncs.push(
      listen<string>("auto_sync_started", (event) => {
        toast.info(event.payload); // <-- THAY console.log BẰNG TOAST
      })
    );
    unlistenFuncs.push(
      listen<string>("auto_sync_complete", (event) => {
        toast.success(event.payload); // <-- THAY console.log BẰNG TOAST
      })
    );
    unlistenFuncs.push(
      listen<string>("auto_sync_error", (event) => {
        toast.error(`Lỗi đồng bộ: ${event.payload}`); // <-- THAY console.error BẰNG TOAST
      })
    );

    // --- THÊM LISTENER MỚI CHO VIỆC THEO DÕI FILE ---
    unlistenFuncs.push(
      listen<void>("file_change_detected", () => {
        // Chỉ quét lại nếu không đang trong một quá trình quét khác
        if (!useAppStore.getState().isScanning) {
          toast.info("Phát hiện thay đổi, bắt đầu quét lại dự án...");
          rescanProject();
        }
      })
    );

    // Dọn dẹp listener khi component unmount
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
    rescanProject, // <-- Thêm dependency
  ]); // <-- Thêm dependency

  const renderContent = () => {
    // Ưu tiên hiển thị màn hình quét
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
      case "dashboard":
      default:
        return <DashboardScene />;
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground">
      {/* --- THÊM COMPONENT TOASTER VÀO ĐÂY --- */}
      <Toaster richColors />
      {renderContent()}
    </div>
  );
}

export default App;
