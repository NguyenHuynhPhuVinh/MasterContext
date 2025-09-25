// src/components/GitPanel.tsx
import { useEffect } from "react";
import { useAppStore, useAppActions } from "@/store/appStore";
import { useShallow } from "zustand/react/shallow";
import {
  Loader2,
  GitBranch,
  AlertTriangle,
  Download,
  User,
  Calendar,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "./ui/badge";

export function GitPanel() {
  const { checkGitRepo, fetchGitCommits, exportCommitDiff } = useAppActions();
  const { rootPath, gitRepoInfo, gitCommits, gitLogState, hasMoreCommits } =
    useAppStore(
      useShallow((state) => ({
        rootPath: state.rootPath,
        gitRepoInfo: state.gitRepoInfo,
        gitCommits: state.gitCommits,
        gitLogState: state.gitLogState,
        hasMoreCommits: state.hasMoreCommits,
      }))
    );

  useEffect(() => {
    // CHỈ KIỂM TRA KHI CÓ ĐƯỜNG DẪN VÀ CHƯA CÓ THÔNG TIN REPO
    if (rootPath && !gitRepoInfo) {
      checkGitRepo();
    }
  }, [rootPath, gitRepoInfo, checkGitRepo]);

  const renderContent = () => {
    // SỬA LỖI TẠI ĐÂY: Chỉ hiển thị loading ban đầu khi chưa có thông tin repo
    if (!gitRepoInfo) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
          <Loader2 className="h-8 w-8 animate-spin mb-4" />
          <p>Đang kiểm tra kho Git...</p>
        </div>
      );
    }

    if (!gitRepoInfo?.isRepository) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
          <AlertTriangle className="h-8 w-8 mb-4" />
          <p>Thư mục hiện tại không phải là một kho lưu trữ Git.</p>
        </div>
      );
    }

    return (
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {gitRepoInfo.remoteUrl && (
            <div className="px-2 py-1">
              <Badge variant="secondary" className="w-full justify-start">
                <GitBranch className="h-3 w-3 mr-2" />
                <span className="truncate text-xs">
                  {gitRepoInfo.remoteUrl}
                </span>
              </Badge>
            </div>
          )}
          {gitCommits.map((commit) => (
            <div
              key={commit.sha}
              className="p-2 rounded-md border bg-background/50 space-y-2"
            >
              <div className="flex items-start justify-between">
                <p className="font-mono text-xs text-blue-500 dark:text-blue-400">
                  {commit.sha.substring(0, 7)}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportCommitDiff(commit.sha)}
                  className="h-7"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p
                className="text-sm font-medium leading-snug"
                title={commit.message}
              >
                <MessageSquare className="inline-block h-3.5 w-3.5 mr-1.5 align-middle text-muted-foreground" />
                {commit.message}
              </p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center" title="Tác giả">
                  <User className="h-3 w-3 mr-1" /> {commit.author}
                </span>
                <span className="flex items-center" title="Ngày commit">
                  <Calendar className="h-3 w-3 mr-1" /> {commit.date}
                </span>
              </div>
            </div>
          ))}
          {gitLogState === "loading_commits" && (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {hasMoreCommits && gitLogState !== "loading_commits" && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fetchGitCommits(true)}
            >
              Tải thêm
            </Button>
          )}
        </div>
      </ScrollArea>
    );
  };

  return (
    <div className="flex flex-col h-full bg-card">
      <header className="flex items-center justify-between p-4 border-b shrink-0">
        <h1 className="text-xl font-bold">Lịch sử Git</h1>
      </header>
      {renderContent()}
    </div>
  );
}
