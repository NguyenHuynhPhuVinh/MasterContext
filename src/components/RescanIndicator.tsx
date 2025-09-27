// src/components/RescanIndicator.tsx
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { useShallow } from "zustand/react/shallow";

export function RescanIndicator() {
  const { t } = useTranslation();
  const { currentFile, currentPhase } = useAppStore(
    useShallow((state) => state.scanProgress)
  );

  const titleText =
    currentPhase === "analyzing"
      ? t("scanning.analyzing")
      : t("scanning.scanning");

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border bg-card p-3 text-sm shadow-lg animate-in fade-in">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <div className="flex flex-col">
        <span className="font-semibold text-card-foreground">{titleText}</span>
        <span className="max-w-xs truncate font-mono text-xs text-muted-foreground">
          {currentFile || t("scanning.initializing")}
        </span>
      </div>
    </div>
  );
}
