// src/App.tsx
import { useEffect } from "react"; // <-- Thêm useEffect
import { listen } from "@tauri-apps/api/event"; // <-- Thêm listen
import { useAppStore, useAppActions, ProjectStats } from "./store/appStore"; // <-- Thêm ProjectStats
import { WelcomeScene } from "./scenes/WelcomeScene";
import { DashboardScene } from "./scenes/DashboardScene";
import { GroupEditorScene } from "./scenes/GroupEditorScene";
import { ScanningScene } from "./scenes/ScanningScene"; // <-- Import scene mới
import "./App.css";

function App() {
  const selectedPath = useAppStore((state) => state.selectedPath);
  const activeScene = useAppStore((state) => state.activeScene);
  const isScanning = useAppStore((state) => state.isScanning); // <-- Lấy state isScanning
  const { _setScanProgress, _setScanComplete, _setScanError } = useAppActions();

  // --- LẮNG NGHE SỰ KIỆN TỪ RUST ---
  useEffect(() => {
    const unlistenFuncs: Promise<() => void>[] = [];

    unlistenFuncs.push(
      listen<string>("scan_progress", (event) => {
        _setScanProgress(event.payload);
      })
    );

    unlistenFuncs.push(
      listen<ProjectStats>("scan_complete", (event) => {
        _setScanComplete(event.payload);
      })
    );

    unlistenFuncs.push(
      listen<string>("scan_error", (event) => {
        _setScanError(event.payload);
      })
    );

    // Dọn dẹp listener khi component unmount
    return () => {
      unlistenFuncs.forEach((unlisten) => {
        unlisten.then((f) => f());
      });
    };
  }, [_setScanProgress, _setScanComplete, _setScanError]);

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
