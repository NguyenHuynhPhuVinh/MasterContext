// src/scenes/settings/ExportTab.tsx
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface ExportTabProps {
  exportUseFullTree: boolean;
  setExportUseFullTree: (enabled: boolean) => void;
  exportWithLineNumbers: boolean;
  setExportWithLineNumbers: (enabled: boolean) => void;
  exportWithoutComments: boolean;
  setExportWithoutComments: (enabled: boolean) => void;
}

export function ExportTab({
  exportUseFullTree,
  setExportUseFullTree,
  exportWithLineNumbers,
  setExportWithLineNumbers,
  exportWithoutComments,
  setExportWithoutComments,
}: ExportTabProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Cài đặt Xuất File</h2>
      <div className="space-y-4 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <Label
            htmlFor="export-tree-toggle"
            className="flex flex-col items-start gap-1"
          >
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
          <Label
            htmlFor="export-lines-toggle"
            className="flex flex-col items-start gap-1"
          >
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
        <div className="flex items-center justify-between pt-4 border-t">
          <Label
            htmlFor="export-comments-toggle"
            className="flex flex-col items-start gap-1"
          >
            <span>Loại bỏ chú thích (comment)</span>
            <span className="text-xs text-muted-foreground">
              Tự động xóa các dòng chú thích khỏi mã nguồn để giảm token.
            </span>
          </Label>
          <Switch
            id="export-comments-toggle"
            checked={exportWithoutComments}
            onCheckedChange={setExportWithoutComments}
          />
        </div>
      </div>
    </div>
  );
}
