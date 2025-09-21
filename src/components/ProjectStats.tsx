// src/components/ProjectStats.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { File, Folder, HardDrive } from "lucide-react";
import { type ProjectStats as ProjectStatsData } from "@/hooks/useProjectStats"; // Import type
import { formatBytes } from "@/lib/utils"; // Import hàm tiện ích

interface ProjectStatsProps {
  path: string | null;
  stats: ProjectStatsData | null;
}

export function ProjectStats({ path, stats }: ProjectStatsProps) {
  return (
    <div className="fixed bottom-4 left-4 z-10">
      <Card className="w-80">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Thống kê dự án</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Folder className="h-4 w-4 shrink-0" />
              <span className="truncate" title={path ?? ""}>
                {path ?? "..."}
              </span>
            </div>
            {/* --- CẬP NHẬT: Hiển thị dữ liệu từ `stats` --- */}
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
              </>
            ) : (
              <div className="pt-2">Đang tải thống kê...</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
