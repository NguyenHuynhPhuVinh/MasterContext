// src/scenes/DashboardScene.tsx
import { useAppStore } from "@/store/appStore";
import { useDirectoryReader } from "@/hooks/useDirectoryReader";
import { ProjectStats } from "@/components/ProjectStats";
import { GroupManager } from "@/scenes/GroupManager";

export function DashboardScene() {
  const selectedPath = useAppStore((state) => state.selectedPath);
  const { fileCount, directoryCount, isLoading } =
    useDirectoryReader(selectedPath);

  if (isLoading && !selectedPath) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-lg text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-y-auto">
      <GroupManager />
      <ProjectStats
        path={selectedPath}
        fileCount={fileCount}
        directoryCount={directoryCount}
      />
    </div>
  );
}
