// src/scenes/SettingsScene.tsx
import { useState, useEffect } from "react";
import { useAppStore, useAppActions } from "@/store/appStore";
import { useShallow } from "zustand/react/shallow";
import { open, message } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  FolderUp,
  Loader2,
  FileText,
  X,
  Palette,
  FolderCog,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge"; // <-- THÊM IMPORT MỚI
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area"; // <-- THÊM IMPORT NÀY
type SettingsTab = "appearance" | "project" | "profile";

export function SettingsScene() {
  const {
    syncEnabled,
    syncPath,
    customIgnorePatterns,
    activeProfile,
    isWatchingFiles,
    rootPath,
    exportUseFullTree,
    exportWithLineNumbers, // <-- THÊM STATE MỚI
  } = useAppStore(
    useShallow((state) => ({
      syncEnabled: state.syncEnabled,
      syncPath: state.syncPath,
      customIgnorePatterns: state.customIgnorePatterns,
      activeProfile: state.activeProfile,
      isWatchingFiles: state.isWatchingFiles,
      rootPath: state.rootPath,
      exportUseFullTree: state.exportUseFullTree,
      exportWithLineNumbers: state.exportWithLineNumbers, // <-- LẤY STATE MỚI
    }))
  );
  const {
    setSyncSettings,
    setCustomIgnorePatterns,
    setFileWatching,
    showDashboard, // Dùng để đóng scene
    setExportUseFullTree,
    setExportWithLineNumbers, // <-- THÊM ACTION MỚI
  } = useAppActions();

  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");
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
      showDashboard();
    } finally {
      setIsSaving(false);
    }
  };

  const TABS = [
    { id: "appearance", label: "Giao diện", icon: Palette },
    { id: "project", label: "Dự án", icon: FolderCog },
    { id: "profile", label: "Hồ sơ", icon: User },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "appearance":
        return (
          <div key="appearance" className="space-y-6">
            <h2 className="text-xl font-semibold">Cài đặt Giao diện</h2>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <Label htmlFor="theme-toggle" className="text-base">
                Chủ đề (Sáng/Tối)
              </Label>
              <ThemeToggle />
            </div>
          </div>
        );
      case "project":
        return (
          <div key="project" className="space-y-6">
            <h2 className="text-xl font-semibold">Cài đặt Toàn cục Dự án</h2>
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

            <div className="space-y-4 rounded-lg border p-4 flex flex-col h-[300px]">
              <h3 className="font-semibold">Các mẫu loại trừ tùy chỉnh</h3>
              <div className="space-y-2 flex-grow flex flex-col">
                <Label htmlFor="custom-ignore">
                  Mẫu Glob (một mẫu mỗi dòng)
                </Label>
                <Textarea
                  id="custom-ignore"
                  placeholder={`dist/\n*.log\n__pycache__/`}
                  className="flex-1 resize-none"
                  value={ignoreText}
                  onChange={(e) => setIgnoreText(e.target.value)}
                  disabled={isSaving}
                />
                <p className="text-xs text-muted-foreground">
                  Các mẫu này sẽ được sử dụng cùng với file .gitignore.
                </p>
              </div>
              <Button
                onClick={handleSaveIgnorePatterns}
                disabled={isSaving}
                className="w-full mt-4"
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lưu và Quét lại
              </Button>
            </div>
          </div>
        );
      case "profile":
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">
              Cài đặt cho Hồ sơ Hiện tại
            </h2>
            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="font-semibold">Cài đặt Xuất File</h3>
              <div className="flex items-center justify-between">
                <Label htmlFor="export-tree-toggle" className="flex flex-col">
                  <span>Sử dụng cây thư mục đầy đủ</span>
                  <span className="text-xs text-muted-foreground">
                    Bật để file ngữ cảnh luôn có cấu trúc dự án đầy đủ.
                  </span>
                </Label>
                <Switch
                  id="export-tree-toggle"
                  checked={exportUseFullTree}
                  onCheckedChange={setExportUseFullTree}
                />
              </div>
              <div className="flex items-center justify-between pt-4 border-t">
                <Label htmlFor="export-lines-toggle" className="flex flex-col">
                  <span>Thêm số dòng vào nội dung file</span>
                  <span className="text-xs text-muted-foreground">
                    Bật để thêm `số_dòng:` vào đầu mỗi dòng code.
                  </span>
                </Label>
                <Switch
                  id="export-lines-toggle"
                  checked={exportWithLineNumbers}
                  onCheckedChange={setExportWithLineNumbers}
                />
              </div>
            </div>
            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="font-semibold">Đồng bộ tự động</h3>
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
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between p-4 border-b shrink-0">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Cài đặt</h1>
            <Badge variant="secondary" className="gap-2">
              <FileText className="h-4 w-4" />
              Hồ sơ: <span className="font-semibold">{activeProfile}</span>
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Tùy chỉnh các thiết lập cho ứng dụng.
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={showDashboard}>
          <X className="h-5 w-5" />
          <span className="sr-only">Đóng</span>
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Thanh điều hướng bên trái */}
        <nav className="w-56 border-r p-4">
          <ul className="space-y-1">
            {TABS.map((tab) => (
              <li key={tab.id}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-3",
                    activeTab === tab.id && "bg-accent"
                  )}
                  onClick={() => setActiveTab(tab.id as SettingsTab)}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </Button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Nội dung bên phải được bọc trong ScrollArea */}
        <ScrollArea className="flex-1">
          <main className="p-6">
            <div className="max-w-2xl mx-auto">{renderContent()}</div>
          </main>
        </ScrollArea>
      </div>
    </div>
  );
}
