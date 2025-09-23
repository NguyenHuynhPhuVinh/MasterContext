// src/scenes/settings/ExportTab.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, Loader2 } from "lucide-react";

interface ExportTabProps {
  exportUseFullTree: boolean;
  setExportUseFullTree: (enabled: boolean) => void;
  exportWithLineNumbers: boolean;
  setExportWithLineNumbers: (enabled: boolean) => void;
  exportWithoutComments: boolean;
  setExportWithoutComments: (enabled: boolean) => void;
  exportSuperCompressed: boolean;
  setExportSuperCompressed: (enabled: boolean) => void;
  exportRemoveDebugLogs: boolean;
  setExportRemoveDebugLogs: (enabled: boolean) => void;
  exportExcludeExtensions: string[];
  setExportExcludeExtensions: (extensions: string[]) => Promise<void>;
}

export function ExportTab({
  exportUseFullTree,
  setExportUseFullTree,
  exportWithLineNumbers,
  setExportWithLineNumbers,
  exportWithoutComments,
  setExportWithoutComments,
  exportSuperCompressed,
  setExportSuperCompressed,
  exportRemoveDebugLogs,
  setExportRemoveDebugLogs,
  exportExcludeExtensions,
  setExportExcludeExtensions,
}: ExportTabProps) {
  const [localExcludeText, setLocalExcludeText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalExcludeText(exportExcludeExtensions.join(", "));
  }, [exportExcludeExtensions]);

  const handleSave = async () => {
    setIsSaving(true);
    const extensions = localExcludeText
      .split(",")
      .map((s) => s.trim().toLowerCase().replace(/^\./, "")) // remove leading dots
      .filter(Boolean);
    await setExportExcludeExtensions([...new Set(extensions)]);
    setIsSaving(false);
  };
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
            className={cn(
              "flex flex-col items-start gap-1",
              exportSuperCompressed && "opacity-50"
            )}
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
            disabled={exportSuperCompressed}
          />
        </div>
        <div className="flex items-center justify-between pt-4 border-t">
          <Label
            htmlFor="export-super-compressed-toggle"
            className="flex flex-col items-start gap-1"
          >
            <span>Xuất siêu nén</span>
            <span className="text-xs text-muted-foreground">
              Nén nội dung file thành một dòng và đặt cạnh tên file trong cây
              thư mục.
            </span>
          </Label>
          <Switch
            id="export-super-compressed-toggle"
            checked={exportSuperCompressed}
            onCheckedChange={setExportSuperCompressed}
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
        <div className="flex items-center justify-between pt-4 border-t">
          <Label
            htmlFor="export-debug-toggle"
            className="flex flex-col items-start gap-1"
          >
            <span>Loại bỏ debug logs</span>
            <span className="text-xs text-muted-foreground">
              Xóa `console.log`, `println!`... khỏi mã nguồn khi xuất.
            </span>
          </Label>
          <Switch
            id="export-debug-toggle"
            checked={exportRemoveDebugLogs}
            onCheckedChange={setExportRemoveDebugLogs}
          />
        </div>
        <div className="flex flex-col space-y-3 pt-4 border-t">
          <div className="flex flex-col items-start gap-1">
            <Label htmlFor="export-exclude-extensions">
              Loại trừ các phần mở rộng
            </Label>
            <span className="text-xs text-muted-foreground">
              Các tệp có phần mở rộng này sẽ không được đưa vào file ngữ cảnh.
            </span>
          </div>
          <Input
            id="export-exclude-extensions"
            placeholder="png, svg, jpg, lock..."
            value={localExcludeText}
            onChange={(e) => setLocalExcludeText(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Phân cách các phần mở rộng bằng dấu phẩy (,).
          </p>
          <Button
            onClick={handleSave}
            disabled={
              isSaving ||
              localExcludeText === exportExcludeExtensions.join(", ")
            }
            className="w-full mt-2"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Lưu cài đặt loại trừ
          </Button>
        </div>
      </div>
    </div>
  );
}
