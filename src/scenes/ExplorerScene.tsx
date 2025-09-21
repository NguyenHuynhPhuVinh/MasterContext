// src/scenes/ExplorerScene.tsx
import { useAppStore, useAppActions } from "@/store/appStore";
import { useDirectoryReader } from "@/hooks/useDirectoryReader";
import { FileExplorer } from "@/components/FileExplorer";

export function ExplorerScene() {
  // Lấy state và actions từ store
  const selectedPath = useAppStore((state) => state.selectedPath);
  const { navigateTo, goBack } = useAppActions();

  // Dùng custom hook để lấy dữ liệu
  const { contents, isLoading, error } = useDirectoryReader(selectedPath);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-lg text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  if (error) {
    // Có thể thêm nút để quay lại
    return (
      <div className="flex flex-1 items-center justify-center text-center">
        <div>
          <p className="text-lg text-destructive">{error}</p>
          <button
            onClick={goBack}
            className="mt-4 rounded bg-primary px-4 py-2 text-primary-foreground"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  if (!selectedPath) {
    // Trường hợp này hiếm khi xảy ra nhưng để đảm bảo an toàn
    return null;
  }

  return (
    <FileExplorer
      path={selectedPath}
      contents={contents}
      onBack={goBack}
      onDirectoryClick={navigateTo}
    />
  );
}
