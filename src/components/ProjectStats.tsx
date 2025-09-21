// src/components/ProjectStats.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// --- CẬP NHẬT: Thêm icon BrainCircuit ---
import { File, Folder, HardDrive, Info, BrainCircuit } from "lucide-react";
import { type ProjectStats as ProjectStatsData } from "@/store/appStore"; // Import type từ store
import { formatBytes } from "@/lib/utils"; // Import hàm tiện ích
// --- CẬP NHẬT: Import Tooltip ---
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ProjectStatsProps {
  path: string | null;
  stats: ProjectStatsData | null;
}

export function ProjectStats({ path, stats }: ProjectStatsProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Thống kê dự án</CardTitle>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-4 w-4 cursor-help text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent>
            <p>
              Các tệp bị loại trừ bởi .gitignore và các file lock (ví dụ:
              package-lock.json, Cargo.lock) sẽ không được tính.
            </p>
          </TooltipContent>
        </Tooltip>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 shrink-0" />
            <span className="truncate" title={path ?? ""}>
              {path ?? "..."}
            </span>
          </div>
          {stats ? (
            <>
              <div className="flex items-center gap-2">
                <File className="h-4 w-4" />
                <span>{stats.total_files.toLocaleString()} tệp tin</span>
              </div>
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4" />
                <span>{stats.total_dirs.toLocaleString()} thư mục</span>
              </div>
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                <span>Tổng dung lượng: {formatBytes(stats.total_size)}</span>
              </div>
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-4 w-4" />
                <span>
                  Ước tính: {stats.total_tokens.toLocaleString()} tokens
                </span>
              </div>
            </>
          ) : (
            <div className="pt-2">Đang tải thống kê...</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
