// src/scenes/ScanningScene.tsx
import { useAppStore } from "@/store/appStore";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

export function ScanningScene() {
  const { t } = useTranslation();
  const { currentFile, currentPhase } = useAppStore(
    useShallow((state) => state.scanProgress)
  );

  const titleText =
    currentPhase === "analyzing"
      ? t("scanningScene.analyzingContent")
      : t("scanningScene.analyzingProject");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <h2 className="text-2xl font-semibold">{titleText}</h2>
      <p className="text-muted-foreground max-w-xl truncate text-center font-mono text-sm">
        {currentFile ? currentFile : t("scanningScene.initializing")}
      </p>
    </div>
  );
}
