// src/scenes/settings/ProfileTab.tsx
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FolderUp } from "lucide-react";

interface ProfileTabProps {
  exportUseFullTree: boolean;
  setExportUseFullTree: (enabled: boolean) => void;
  exportWithLineNumbers: boolean;
  setExportWithLineNumbers: (enabled: boolean) => void;
  syncEnabled: boolean;
  handleToggleSync: (enabled: boolean) => void;
  syncPath: string | null;
  handleChooseSyncPath: () => void;
}

export function ProfileTab({
  exportUseFullTree,
  setExportUseFullTree,
  exportWithLineNumbers,
  setExportWithLineNumbers,
  syncEnabled,
  handleToggleSync,
  syncPath,
  handleChooseSyncPath,
}: ProfileTabProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Cài đặt cho Hồ sơ Hiện tại</h2>
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
}
