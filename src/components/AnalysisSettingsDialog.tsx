// src/components/AnalysisSettingsDialog.tsx
import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";

interface AnalysisSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialExtensions: string[];
  onSave: (extensions: string[]) => void;
}

export function AnalysisSettingsDialog({
  isOpen,
  onClose,
  initialExtensions,
  onSave,
}: AnalysisSettingsDialogProps) {
  const [extensionsText, setExtensionsText] = useState("");

  useEffect(() => {
    if (isOpen) {
      setExtensionsText(initialExtensions.join(", "));
    }
  }, [isOpen, initialExtensions]);

  const handleSave = () => {
    const extensions = extensionsText
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean); // Lọc bỏ các chuỗi rỗng
    // Sử dụng Set để loại bỏ các extension trùng lặp
    onSave([...new Set(extensions)]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Cài đặt Phân tích Nội dung</DialogTitle>
          <DialogDescription>
            Các tệp có phần mở rộng dưới đây sẽ không được đọc nội dung để đếm
            token hoặc phân tích liên kết, giúp tăng tốc độ quét.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full gap-1.5">
            <Label htmlFor="extensions">Các phần mở rộng cần bỏ qua</Label>
            <Input
              id="extensions"
              placeholder="png, svg, lock, jpg..."
              value={extensionsText}
              onChange={(e) => setExtensionsText(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Phân cách các phần mở rộng bằng dấu phẩy (,).
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" onClick={handleSave}>
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
