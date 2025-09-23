// src/components/StatusBar.tsx
import { File, Folder, HardDrive, BrainCircuit, GitBranch } from "lucide-react";
import { type ProjectStats } from "@/store/types";
import { formatBytes } from "@/lib/utils";

interface StatusBarProps {
  path: string | null;
  stats: ProjectStats | null;
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

export function StatusBar({ path, stats }: StatusBarProps) {
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
          <GitBranch className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold">{shortPath}</span>
        </div>
        <div className="w-px h-4 bg-border" />
      </div>

      <div className="flex h-full items-center ml-auto">
        {stats ? (
          <>
            <StatItem
              icon={File}
              value={stats.total_files.toLocaleString()}
              title="Tổng số tệp tin"
            />
            <StatItem
              icon={Folder}
              value={stats.total_dirs.toLocaleString()}
              title="Tổng số thư mục"
            />
            <StatItem
              icon={HardDrive}
              value={formatBytes(stats.total_size)}
              title="Tổng dung lượng"
            />
            <StatItem
              icon={BrainCircuit}
              value={`${stats.total_tokens.toLocaleString()} tokens`}
              title="Ước tính số Tokens"
            />
          </>
        ) : (
          <span className="text-xs px-3">Đang tải thống kê...</span>
        )}
      </div>
    </footer>
  );
}
