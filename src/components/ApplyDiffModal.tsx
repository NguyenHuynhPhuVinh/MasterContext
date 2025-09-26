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
  onApply: (filePath: string, diff: string) => void;
}

export function ApplyDiffModal({
  isOpen,
  onClose,
  filePath,
  onApply,
}: ApplyDiffModalProps) {
  const { t } = useTranslation();
  const [diffText, setDiffText] = useState("");

  const handleApply = () => {
    if (filePath && diffText.trim()) {
      onApply(filePath, diffText);
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
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t("diffModal.title", { file: filePath })}</DialogTitle>
          <DialogDescription>{t("diffModal.description")}</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea
            placeholder="--- a/file.js
+++ b/file.js
@@ -1,4 +1,4 @@
 ..."
            className="min-h-[300px] font-mono text-xs"
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
