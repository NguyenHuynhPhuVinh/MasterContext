// src/scenes/settings/ProjectTab.tsx
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ProjectTabProps {
  isWatchingFiles: boolean;
  setFileWatching: (enabled: boolean) => void;
  rootPath: string | null;
  ignoreText: string;
  setIgnoreText: (text: string) => void;
  isSaving: boolean;
  handleSaveIgnorePatterns: () => void;
  isDeleteProjectDialogOpen: boolean;
  setIsDeleteProjectDialogOpen: (isOpen: boolean) => void;
  handleConfirmDeleteProjectData: () => void;
}

export function ProjectTab({
  isWatchingFiles,
  setFileWatching,
  rootPath,
  ignoreText,
  setIgnoreText,
  isSaving,
  handleSaveIgnorePatterns,
  isDeleteProjectDialogOpen,
  setIsDeleteProjectDialogOpen,
  handleConfirmDeleteProjectData,
}: ProjectTabProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Cài đặt Toàn cục Dự án</h2>
      <div className="space-y-4 rounded-lg border p-4">
        <h3 className="font-semibold">Theo dõi dự án</h3>
        <div className="flex items-center justify-between">
          <Label
            htmlFor="watching-toggle"
            className="flex flex-col items-start"
          >
            <span>Theo dõi thời gian thực</span>
            <span className="text-xs text-muted-foreground">
              Tự động quét lại khi có thay đổi file.
            </span>
          </Label>
          <Switch
            id="watching-toggle"
            checked={isWatchingFiles}
            onCheckedChange={setFileWatching}
            disabled={!rootPath}
          />
        </div>
      </div>

      <div className="space-y-4 rounded-lg border p-4 flex flex-col">
        <h3 className="font-semibold">Các mẫu loại trừ tùy chỉnh</h3>
        <div className="space-y-2 flex-grow flex flex-col">
          <Label htmlFor="custom-ignore">Mẫu Glob (một mẫu mỗi dòng)</Label>
          <Textarea
            id="custom-ignore"
            placeholder={`dist/\n*.log\n__pycache__/`}
            className="flex-1 resize-y min-h-[120px]"
            value={ignoreText}
            onChange={(e) => setIgnoreText(e.target.value)}
            disabled={isSaving}
          />
          <p className="text-xs text-muted-foreground">
            Các mẫu này sẽ được sử dụng cùng với file .gitignore.
          </p>
        </div>
        <Button
          onClick={handleSaveIgnorePatterns}
          disabled={isSaving}
          className="w-full mt-4"
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Lưu và Quét lại
        </Button>
      </div>

      <div className="space-y-4 rounded-lg border border-destructive/50 p-4">
        <h3 className="font-semibold text-destructive flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Vùng nguy hiểm
        </h3>
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-start pr-4">
            <span>Xóa dữ liệu dự án</span>
            <span className="text-xs text-muted-foreground">
              Hành động này sẽ xóa tất cả hồ sơ, nhóm và cài đặt cho dự án này.
              Không thể hoàn tác.
            </span>
          </div>
          <Button
            variant="destructive"
            onClick={() => setIsDeleteProjectDialogOpen(true)}
          >
            Xóa dữ liệu
          </Button>
        </div>
      </div>

      <AlertDialog
        open={isDeleteProjectDialogOpen}
        onOpenChange={setIsDeleteProjectDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn không?</AlertDialogTitle>
            <AlertDialogDescription>
              Toàn bộ dữ liệu của dự án này (bao gồm tất cả các hồ sơ và nhóm)
              sẽ bị xóa vĩnh viễn. Hành động này không thể được hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleConfirmDeleteProjectData}
            >
              Tôi hiểu, hãy xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
