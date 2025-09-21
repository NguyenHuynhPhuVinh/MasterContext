// src/scenes/DashboardScene.tsx
import { useAppStore } from "@/store/appStore";
import { useProjectStats } from "@/hooks/useProjectStats"; // <-- Đổi import
import { ProjectStats as ProjectStatsComponent } from "@/components/ProjectStats"; // Đổi tên để tránh xung đột
import { GroupManager } from "@/components/GroupManager";

export function DashboardScene() {
  const selectedPath = useAppStore((state) => state.selectedPath);
  // --- CẬP NHẬT: Sử dụng hook mới và nhận về `stats` ---
  const { stats, isLoading } = useProjectStats(selectedPath);

  if (isLoading && !stats) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-lg text-muted-foreground">Đang quét dự án...</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-y-auto p-8">
      <GroupManager />
      {/* Truyền `stats` xuống component con */}
      <ProjectStatsComponent path={selectedPath} stats={stats} />
    </div>
  );
}
