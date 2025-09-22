// src/components/SettingsDialog.tsx
import { useAppStore, useAppActions } from "@/store/appStore";
import { useShallow } from "zustand/react/shallow";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "./ThemeToggle";
import { FolderUp } from "lucide-react";

interface SettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ isOpen, onOpenChange }: SettingsDialogProps) {
  const { syncEnabled, syncPath } = useAppStore(
    useShallow((state) => ({
      syncEnabled: state.syncEnabled,
      syncPath: state.syncPath,
    }))
  );
  const { setSyncSettings } = useAppActions();

  const handleToggleSync = (enabled: boolean) => {
    // Nếu bật mà chưa có đường dẫn, không làm gì cả (bắt buộc chọn thư mục trước)
    if (enabled && !syncPath) {
      alert("Bạn phải chọn một thư mục đồng bộ trước khi bật tính năng này.");
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
        // Cập nhật đường dẫn và tự động bật nếu chưa bật
        setSyncSettings({ enabled: true, path: result });
      }
    } catch (error) {
      console.error("Lỗi khi chọn thư mục đồng bộ:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cài đặt</DialogTitle>
          <DialogDescription>
            Tùy chỉnh các thiết lập cho ứng dụng.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Cài đặt Giao diện */}
          <div className="flex items-center justify-between">
            <Label htmlFor="theme-toggle">Giao diện (Sáng/Tối)</Label>
            <ThemeToggle />
          </div>

          {/* Cài đặt Đồng bộ tự động */}
          <div className="space-y-4 rounded-lg border p-4">
            <h3 className="font-semibold">Đồng bộ tự động</h3>
            <div className="flex items-center justify-between">
              <Label htmlFor="sync-toggle" className="flex flex-col">
                <span>Bật đồng bộ trong nền</span>
                <span className="text-xs text-muted-foreground">
                  Tự động xuất lại khi phát hiện thay đổi.
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
      </DialogContent>
    </Dialog>
  );
}
