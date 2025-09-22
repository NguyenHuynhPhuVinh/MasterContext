// src/App.tsx
import { useEffect, useMemo } from "react"; // <-- Thêm useMemo
import { listen } from "@tauri-apps/api/event";
import {
  useAppStore,
  useAppActions,
  GroupStats,
  CachedProjectData,
} from "./store/appStore";
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
  } = useAppActions();

  // --- ĐỊNH NGHĨA PAYLOAD ĐÚNG ---
  // interface ScanCompletePayload {
  //   stats: ProjectStats;
  //   fileTree: FileNode;
  // }

  // --- THAY ĐỔI: Tạo một phiên bản throttled của hàm cập nhật ---
  const throttledSetScanProgress = useMemo(
    () => throttle((file: string) => _setScanProgress(file), 10), // Cập nhật tối đa 10 lần/giây
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
      })
    );

    unlistenFuncs.push(
      listen<string>("scan_error", (event) => {
        _setScanError(event.payload);
      })
    );

    // Thêm listener cho group_update_complete
    unlistenFuncs.push(
      // --- THAY ĐỔI: Thêm `paths` vào payload ---
      listen<{ groupId: string; stats: GroupStats; paths: string[] }>(
        "group_update_complete",
        (event) => {
          _setGroupUpdateComplete(event.payload);
        }
      )
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
      {renderContent()}
    </div>
  );
}

export default App;
