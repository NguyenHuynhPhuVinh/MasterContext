// src/components/ApplyDiffModal.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ApplyDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string | null;
  onApply: (filePath: string, diff: string) => Promise<void>;
}

export function ApplyDiffModal({
  isOpen,
  onClose,
  filePath,
  onApply,
}: ApplyDiffModalProps) {
  const { t } = useTranslation();
  const [diffText, setDiffText] = useState("");

  const handleApply = async () => {
    if (filePath && diffText.trim()) {
      await onApply(filePath, diffText);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      setDiffText(""); // Reset text area on close
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] flex flex-col h-[85vh]">
        <DialogHeader>
          <DialogTitle>{t("diffModal.title", { file: filePath })}</DialogTitle>
          <DialogDescription>{t("diffModal.description")}</DialogDescription>
        </DialogHeader>
        <div className="py-4 flex-1 min-h-0">
          <Textarea
            placeholder="--- a/file.js
+++ b/file.js
@@ -1,4 +1,4 @@
 ..."
            className="h-full font-mono text-xs resize-none custom-scrollbar"
            value={diffText}
            onChange={(e) => setDiffText(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            onClick={handleApply}
            disabled={!diffText.trim()}
          >
            {t("diffModal.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
