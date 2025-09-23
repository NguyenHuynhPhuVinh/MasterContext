// src/scenes/SettingsScene.tsx
import { useState, useEffect } from "react";
import { useAppStore, useAppActions } from "@/store/appStore";
import { useShallow } from "zustand/react/shallow";
import { open, message } from "@tauri-apps/plugin-dialog"; // <-- THAY ĐỔI IMPORT
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FolderUp, Loader2, FileText, ArrowLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export function SettingsScene() {
  const {
    syncEnabled,
    syncPath,
    customIgnorePatterns,
    activeProfile,
    isWatchingFiles,
    rootPath,
  } = useAppStore(
    useShallow((state) => ({
      syncEnabled: state.syncEnabled,
      syncPath: state.syncPath,
      customIgnorePatterns: state.customIgnorePatterns,
      activeProfile: state.activeProfile,
      isWatchingFiles: state.isWatchingFiles,
      rootPath: state.rootPath,
    }))
  );
  const {
    setSyncSettings,
    setCustomIgnorePatterns,
    setFileWatching,
    showDashboard, // Action để quay lại
  } = useAppActions();

  const [ignoreText, setIgnoreText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIgnoreText((customIgnorePatterns || []).join("\n"));
  }, [customIgnorePatterns]);

  const handleToggleSync = async (enabled: boolean) => {
    if (enabled && !syncPath) {
      await message(
        "Bạn phải chọn một thư mục đồng bộ trước khi bật tính năng này.",
        { title: "Cảnh báo", kind: "warning" }
      );
      return;
    }
    setSyncSettings({ enabled, path: syncPath });
  };

  const handleChooseSyncPath = async () => {
    try {
      const result = await open({
        directory: true,
        multiple: false,
        title: "Chọn thư mục để tự động đồng bộ",
      });
      if (typeof result === "string") {
        setSyncSettings({ enabled: true, path: result });
      }
    } catch (error) {
      console.error("Lỗi khi chọn thư mục đồng bộ:", error);
    }
  };

  const handleSaveIgnorePatterns = async () => {
    setIsSaving(true);
    try {
      const patterns = ignoreText
        .split("\n")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      await setCustomIgnorePatterns(patterns);
      // Sau khi lưu và quét lại, tự động quay về dashboard
      showDashboard();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-2xl font-bold">Cài đặt</h1>
          <p className="text-muted-foreground">
            Tùy chỉnh các thiết lập cho ứng dụng. Các cài đặt sẽ được áp dụng
            cho hồ sơ đang hoạt động.
          </p>
        </div>
        <Button variant="outline" onClick={showDashboard}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại Dashboard
        </Button>
      </header>
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          {/* Cột cài đặt chung */}
          <div className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <Label htmlFor="theme-toggle">Giao diện (Sáng/Tối)</Label>
              <ThemeToggle />
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="font-semibold">Theo dõi dự án</h3>
              <div className="flex items-center justify-between">
                <Label htmlFor="watching-toggle" className="flex flex-col">
                  <span>Theo dõi thời gian thực</span>
                  <span className="text-xs text-muted-foreground">
                    Tự động quét lại khi có thay đổi file.
                  </span>
                </Label>
                <Switch
                  id="watching-toggle"
                  checked={isWatchingFiles}
                  onCheckedChange={setFileWatching}
                  disabled={!rootPath}
                />
              </div>
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Đồng bộ tự động</h3>
                <div className="flex items-center text-sm text-muted-foreground gap-2 border rounded-full px-3 py-1">
                  <FileText className="h-4 w-4" />
                  <span>
                    Hồ sơ:{" "}
                    <span className="font-semibold">{activeProfile}</span>
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground -mt-2">
                Cài đặt này chỉ áp dụng cho hồ sơ hiện tại. Mỗi hồ sơ có thể có
                thư mục đồng bộ riêng.
              </p>
              <div className="flex items-center justify-between">
                <Label htmlFor="sync-toggle" className="flex flex-col">
                  <span>Bật đồng bộ nền</span>
                  <span className="text-xs text-muted-foreground">
                    Tự động xuất lại khi có thay đổi.
                  </span>
                </Label>
                <Switch
                  id="sync-toggle"
                  checked={syncEnabled}
                  onCheckedChange={handleToggleSync}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sync-path">Thư mục đồng bộ</Label>
                <div className="flex items-center gap-2">
                  <div
                    id="sync-path"
                    className="flex-grow truncate rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground"
                  >
                    {syncPath || "Chưa chọn..."}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleChooseSyncPath}
                  >
                    <FolderUp className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Cột cài đặt loại trừ */}
          <div className="space-y-4 rounded-lg border p-4 flex flex-col">
            <h3 className="font-semibold">Các mẫu loại trừ tùy chỉnh</h3>
            <div className="space-y-2 flex-grow flex flex-col">
              <Label htmlFor="custom-ignore">Mẫu Glob (một mẫu mỗi dòng)</Label>
              <Textarea
                id="custom-ignore"
                placeholder={`dist/\n*.log\n__pycache__/`}
                className="h-32 overflow-y-auto resize-none"
                value={ignoreText}
                onChange={(e) => setIgnoreText(e.target.value)}
                disabled={isSaving}
              />
              <p className="text-xs text-muted-foreground">
                Các mẫu này sẽ được sử dụng cùng với file .gitignore của dự án.
              </p>
            </div>
            <div className="pt-4">
              <Button
                onClick={handleSaveIgnorePatterns}
                disabled={isSaving}
                className="w-full"
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lưu và Quét lại
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
