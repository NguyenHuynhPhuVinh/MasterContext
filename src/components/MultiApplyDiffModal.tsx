// src/components/MultiApplyDiffModal.tsx
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

interface MultiApplyDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (diff: string) => void;
}

export function MultiApplyDiffModal({
  isOpen,
  onClose,
  onApply,
}: MultiApplyDiffModalProps) {
  const { t } = useTranslation();
  const [diffText, setDiffText] = useState("");

  const handleApply = () => {
    if (diffText.trim()) {
      onApply(diffText);
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
      <DialogContent className="sm:max-w-[80vw] flex flex-col h-[85vh]">
        <DialogHeader>
          <DialogTitle>{t("multiDiffModal.title")}</DialogTitle>
          <DialogDescription>
            {t("multiDiffModal.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 flex-1 min-h-0">
          <Textarea
            placeholder="--- a/src/file1.ts
+++ b/src/file1.ts
@@ ...
...
--- a/src/file2.tsx
+++ b/src/file2.tsx
@@ ..."
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
            {t("multiDiffModal.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
