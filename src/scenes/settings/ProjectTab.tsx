// src/scenes/settings/ProjectTab.tsx
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface ProjectTabProps {
  isWatchingFiles: boolean;
  setFileWatching: (enabled: boolean) => void;
  rootPath: string | null;
  ignoreText: string;
  setIgnoreText: (text: string) => void;
  isSaving: boolean;
  handleSaveIgnorePatterns: () => void;
}

export function ProjectTab({
  isWatchingFiles,
  setFileWatching,
  rootPath,
  ignoreText,
  setIgnoreText,
  isSaving,
  handleSaveIgnorePatterns,
}: ProjectTabProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Cài đặt Toàn cục Dự án</h2>
      <div className="space-y-4 rounded-lg border p-4">
        <h3 className="font-semibold">Theo dõi dự án</h3>
        <div className="flex items-center justify-between">
          <Label htmlFor="watching-toggle" className="flex flex-col">
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

      <div className="space-y-4 rounded-lg border p-4 flex flex-col h-[300px]">
        <h3 className="font-semibold">Các mẫu loại trừ tùy chỉnh</h3>
        <div className="space-y-2 flex-grow flex flex-col">
          <Label htmlFor="custom-ignore">Mẫu Glob (một mẫu mỗi dòng)</Label>
          <Textarea
            id="custom-ignore"
            placeholder={`dist/\n*.log\n__pycache__/`}
            className="flex-1 resize-none"
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
    </div>
  );
}
