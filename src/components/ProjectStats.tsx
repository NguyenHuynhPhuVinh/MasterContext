// src/components/ProjectStats.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { File, Folder } from "lucide-react";

interface ProjectStatsProps {
  path: string | null;
  fileCount: number;
  directoryCount: number;
}

export function ProjectStats({
  path,
  fileCount,
  directoryCount,
}: ProjectStatsProps) {
  return (
    <div className="fixed bottom-4 left-4 z-10">
      <Card className="w-80">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Thông tin dự án</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Folder className="h-4 w-4" />
              <span className="truncate" title={path ?? ""}>
                {path ?? "..."}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <File className="h-4 w-4" />
              <span>{fileCount} tệp tin</span>
            </div>
            <div className="flex items-center gap-2">
              <Folder className="h-4 w-4" />
              <span>{directoryCount} thư mục</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
