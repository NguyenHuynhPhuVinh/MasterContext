// src/components/SettingsDialog.tsx
import { useState, useEffect } from "react";
import { useAppStore, useAppActions } from "@/store/appStore";
import { useShallow } from "zustand/react/shallow";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner"; // <-- THÊM IMPORT
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea"; // <-- THÊM IMPORT
import { ThemeToggle } from "./ThemeToggle";
import { FolderUp, Loader2, FileText } from "lucide-react";

interface SettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ isOpen, onOpenChange }: SettingsDialogProps) {
  const {
    syncEnabled,
    syncPath,
    customIgnorePatterns,
    activeProfile,
    isWatchingFiles,
    rootPath,
  } = useAppStore(
    // <-- Lấy thêm isWatchingFiles và rootPath
    useShallow((state) => ({
      syncEnabled: state.syncEnabled,
      syncPath: state.syncPath,
      customIgnorePatterns: state.customIgnorePatterns,
      activeProfile: state.activeProfile,
      isWatchingFiles: state.isWatchingFiles, // <-- Lấy state mới
      rootPath: state.rootPath, // <-- Cần để biết có nên cho bật switch không
    }))
  );
  const { setSyncSettings, setCustomIgnorePatterns, setFileWatching } =
    useAppActions(); // <-- Lấy action mới

  // State cục bộ cho textarea và trạng thái loading
  const [ignoreText, setIgnoreText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Đồng bộ state từ store vào state cục bộ khi dialog mở
  useEffect(() => {
    if (isOpen) {
      setIgnoreText((customIgnorePatterns || []).join("\n"));
    }
  }, [isOpen, customIgnorePatterns]);

  const handleToggleSync = (enabled: boolean) => {
    if (enabled && !syncPath) {
      toast.warning(
        "Bạn phải chọn một thư mục đồng bộ trước khi bật tính năng này."
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
      onOpenChange(false); // Đóng dialog sau khi quét lại bắt đầu
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-4xl">
        <DialogHeader>
          <DialogTitle>Cài đặt</DialogTitle>
          <DialogDescription>
            Tùy chỉnh các thiết lập cho ứng dụng. Các cài đặt sẽ được áp dụng
            cho hồ sơ đang hoạt động.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* Cột cài đặt chung */}
          <div className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <Label htmlFor="theme-toggle">Giao diện (Sáng/Tối)</Label>
              <ThemeToggle />
            </div>

            {/* --- THÊM KHỐI CÀI ĐẶT MỚI --- */}
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
                  disabled={!rootPath} // Vô hiệu hóa nếu chưa mở dự án
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
            <DialogFooter>
              <Button
                onClick={handleSaveIgnorePatterns}
                disabled={isSaving}
                className="w-full"
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lưu và Quét lại
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
