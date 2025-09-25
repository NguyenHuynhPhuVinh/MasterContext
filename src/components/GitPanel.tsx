// src/components/GitPanel.tsx
import { useEffect } from "react";
import { useState } from "react";
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
  RefreshCw,
  Clipboard,
  Check,
  BrainCircuit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "./ui/badge";

export function GitPanel() {
  const {
    checkGitRepo,
    fetchGitCommits,
    exportCommitDiff,
    reloadGitCommits,
    copyCommitDiff,
    exportCommitContext,
  } = useAppActions();
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

  const [copyingSha, setCopyingSha] = useState<string | null>(null);
  const [copiedSha, setCopiedSha] = useState<string | null>(null);
  const [exportingContextSha, setExportingContextSha] = useState<string | null>(
    null
  );

  const handleCopy = async (sha: string) => {
    setCopyingSha(sha);
    setCopiedSha(null);
    const success = await copyCommitDiff(sha);
    setCopyingSha(null);
    if (success) {
      setCopiedSha(sha);
      setTimeout(() => {
        setCopiedSha(null);
      }, 2000); // Reset icon after 2 seconds
    }
  };

  const handleExportContext = async (sha: string) => {
    setExportingContextSha(sha);
    await exportCommitContext(sha);
    setExportingContextSha(null);
  };

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
      // Sử dụng Fragment để trả về nhiều phần tử, chúng sẽ trở thành con trực tiếp
      // của container `flex flex-col h-full` trong `GitPanel`
      <>
        {/* Phần URL, cố định, không cuộn */}
        {gitRepoInfo.remoteUrl && (
          <div className="p-2 border-b flex-shrink-0">
            <Badge variant="secondary" className="w-full justify-start">
              <GitBranch className="h-3 w-3 mr-2" />
              <span className="truncate text-xs">{gitRepoInfo.remoteUrl}</span>
            </Badge>
          </div>
        )}
        {/* Khu vực danh sách commit, co giãn và có thể cuộn */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2 space-y-2">
            {gitCommits.map((commit) => (
              <div
                key={commit.sha}
                className="p-2 rounded-md border bg-background/50 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-mono text-xs text-blue-500 dark:text-blue-400 min-w-0 truncate">
                    {commit.sha.substring(0, 7)}
                  </p>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleCopy(commit.sha)}
                      className="h-7 w-7"
                      disabled={copyingSha === commit.sha}
                      title="Sao chép diff"
                    >
                      {copyingSha === commit.sha ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : copiedSha === commit.sha ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Clipboard className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => exportCommitDiff(commit.sha)}
                      className="h-7 w-7"
                      title="Tải về diff"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleExportContext(commit.sha)}
                      className="h-7 w-7"
                      disabled={exportingContextSha === commit.sha}
                      title="Xuất ngữ cảnh commit"
                    >
                      {exportingContextSha === commit.sha ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <BrainCircuit className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
                <p
                  className="text-sm font-medium leading-snug"
                  title={commit.message}
                >
                  <MessageSquare className="inline-block h-3.5 w-3.5 mr-1.5 align-middle text-muted-foreground" />
                  {commit.message}
                </p>
                <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center" title="Tác giả">
                    <User className="h-3 w-3 mr-1" /> {commit.author}
                  </span>
                  <span className="flex items-center" title="Ngày commit">
                    <Calendar className="h-3 w-3 mr-1" /> {commit.date}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        {/* Phần chân panel, cố định, không cuộn */}
        <div className="p-2 border-t flex-shrink-0">
          {gitLogState === "loading_commits" && (
            <div className="flex items-center justify-center h-9">
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
      </>
    );
  };

  return (
    // Đây là container flexbox chính
    <div className="flex flex-col h-full bg-card">
      <header className="flex items-center justify-between p-4 border-b shrink-0">
        <h1 className="text-xl font-bold">Lịch sử Git</h1>
        {/* --- NÚT TẢI LẠI --- */}
        <Button
          variant="ghost"
          size="icon"
          onClick={reloadGitCommits}
          disabled={
            gitLogState === "loading_commits" || !gitRepoInfo?.isRepository
          }
          className="h-8 w-8"
          title="Tải lại commits"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              gitLogState === "loading_commits" ? "animate-spin" : ""
            }`}
          />
        </Button>
      </header>
      {/* Nội dung được render ở đây, là con trực tiếp của container flexbox */}
      {renderContent()}
    </div>
  );
}
