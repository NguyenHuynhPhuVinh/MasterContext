// src/components/StatusBar.tsx
import { useTranslation } from "react-i18next";
import {
  File,
  Folder,
  HardDrive,
  BrainCircuit,
  GitBranch,
  Cog,
} from "lucide-react";
import { type ProjectStats, type GitRepositoryInfo } from "@/store/types";
import { formatBytes } from "@/lib/utils";
import { Button } from "./ui/button";

interface StatusBarProps {
  path: string | null;
  stats: ProjectStats | null;
  gitRepoInfo: GitRepositoryInfo | null;
  onShowSettings: () => void;
}

const StatItem = ({
  icon: Icon,
  value,
  title,
}: {
  icon: React.ElementType;
  value: string | number;
  title: string;
}) => (
  <div
    className="flex items-center gap-1.5 px-3 h-full hover:bg-accent cursor-default"
    title={title}
  >
    <Icon className="h-3.5 w-3.5" />
    <span className="text-xs">{value}</span>
  </div>
);

export function StatusBar({
  path,
  stats,
  gitRepoInfo,
  onShowSettings,
}: StatusBarProps) {
  const { t } = useTranslation();
  const shortPath = path
    ? "..." + path.substring(path.lastIndexOf("/") + 1)
    : "...";

  return (
    <footer className="flex items-center h-7 border-t bg-background text-muted-foreground shrink-0">
      <div className="flex h-full items-center">
        <div
          className="flex items-center gap-1.5 px-3 h-full hover:bg-accent cursor-pointer"
          title={path ?? ""}
        >
          <Folder className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold">{shortPath}</span>
        </div>
        {gitRepoInfo?.isRepository && gitRepoInfo.currentBranch && (
          <>
            <div className="w-px h-4 bg-border" />
            <div
              className="flex items-center gap-1.5 px-3 h-full hover:bg-accent cursor-default"
              title={t("statusBar.gitBranchTooltip")}
            >
              <GitBranch className="h-3.5 w-3.5" />
              <span className="text-xs">{gitRepoInfo.currentBranch}</span>
            </div>
          </>
        )}
      </div>

      <div className="flex h-full items-center ml-auto border-l">
        {stats ? (
          <>
            <StatItem
              icon={File}
              value={stats.total_files.toLocaleString()}
              title={t("statusBar.totalFilesTooltip")}
            />
            <StatItem
              icon={Folder}
              value={stats.total_dirs.toLocaleString()}
              title={t("statusBar.totalDirectoriesTooltip")}
            />
            <StatItem
              icon={HardDrive}
              value={formatBytes(stats.total_size)}
              title={t("statusBar.totalSizeTooltip")}
            />
            <StatItem
              icon={BrainCircuit}
              value={`${stats.total_tokens.toLocaleString()} tokens`}
              title={t("statusBar.estimatedTokensTooltip")}
            />
          </>
        ) : (
          <span className="text-xs px-3">{t("statusBar.loadingStats")}</span>
        )}
        <div className="w-px h-4 bg-border" />
        <Button
          variant="ghost"
          size="icon"
          className="h-full w-7 rounded-none"
          onClick={onShowSettings}
          title={t("statusBar.openSettingsTooltip")}
        >
          <Cog className="h-4 w-4" />
        </Button>
      </div>
    </footer>
  );
}
