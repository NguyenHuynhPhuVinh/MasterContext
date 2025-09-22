// src/scenes/ScanningScene.tsx
import { useAppStore } from "@/store/appStore";
import { Loader2 } from "lucide-react";

export function ScanningScene() {
  const currentFile = useAppStore((state) => state.scanProgress.currentFile);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <h2 className="text-2xl font-semibold">Đang phân tích dự án...</h2>
      <p className="text-muted-foreground max-w-xl truncate text-center font-mono text-sm">
        {currentFile ? currentFile : "Đang khởi tạo..."}
      </p>
    </div>
  );
}
