// src/components/ProjectStats.tsx
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter, // <-- Thêm CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button"; // <-- Thêm Button
import {
  File,
  Folder,
  HardDrive,
  Info,
  BrainCircuit,
  Download,
  Loader2,
  ClipboardCopy, // <-- THÊM ICON MỚI
  Check, // <-- THÊM ICON MỚI
} from "lucide-react"; // <-- Thêm icon
import { type ProjectStats as ProjectStatsData } from "@/store/types"; // <-- Sửa đường dẫn import
import { formatBytes } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// --- CẬP NHẬT: Thêm props cho chức năng sao chép ---
interface ProjectStatsProps {
  path: string | null;
  stats: ProjectStatsData | null;
  onExportProject: () => void;
  isExporting: boolean;
  onCopyProject: () => void; // <-- Prop mới
  isCopying: boolean; // <-- Prop mới
  wasCopied: boolean; // <-- Prop mới
}

export function ProjectStats({
  path,
  stats,
  onExportProject,
  isExporting,
  onCopyProject,
  isCopying,
  wasCopied,
}: ProjectStatsProps) {
  return (
    <Card className="flex flex-col h-fit">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Thống kê dự án</CardTitle>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-4 w-4 cursor-help text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent>
            <p>
              Các tệp bị loại trừ bởi .gitignore và các file lock sẽ không được
              tính.
            </p>
          </TooltipContent>
        </Tooltip>
      </CardHeader>
      <CardContent>
        {/* Phần hiển thị stats giữ nguyên */}
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
      {/* --- PHẦN MỚI: Thêm footer với các nút --- */}
      <CardFooter className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCopyProject}
          disabled={isCopying || isExporting}
          className="w-full"
        >
          {isCopying ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : wasCopied ? (
            <Check className="mr-2 h-4 w-4 text-green-500" />
          ) : (
            <ClipboardCopy className="mr-2 h-4 w-4" />
          )}
          {isCopying ? "Đang xử lý..." : wasCopied ? "Đã chép!" : "Sao chép"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onExportProject}
          disabled={isExporting || isCopying}
          className="w-full"
        >
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {isExporting ? "Đang xuất..." : "Xuất file"}
        </Button>
      </CardFooter>
    </Card>
  );
}
