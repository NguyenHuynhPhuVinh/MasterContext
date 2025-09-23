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
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

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
      .filter(Boolean); // Lọc bỏ các dòng trống
    onSave(extensions);
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
            <Label htmlFor="extensions">
              Các phần mở rộng cần bỏ qua (phân cách bằng dấu phẩy)
            </Label>
            <ScrollArea className="h-[200px] w-full rounded-md border p-2">
              <Textarea
                id="extensions"
                placeholder="png, svg, lock"
                value={extensionsText}
                onChange={(e) => setExtensionsText(e.target.value)}
                className="min-h-[180px] border-0 shadow-none focus-visible:ring-0 resize-none"
              />
            </ScrollArea>
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
