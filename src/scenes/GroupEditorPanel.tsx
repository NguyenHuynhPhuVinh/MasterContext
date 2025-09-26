// src/scenes/GroupEditorPanel.tsx
import { useCallback, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore, useAppActions } from "@/store/appStore";
import { useShallow } from "zustand/react/shallow";
import { FileTreeView, type FileNode } from "@/components/FileTreeView";
import { Button } from "@/components/ui/button";
import {
  Save,
  Loader2,
  Link,
  Link2Off,
  CheckCheck,
  XCircle,
  Search,
  GitMerge,
  FileDiff,
  FilePlus,
  Undo,
} from "lucide-react";
import { Scissors } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ApplyDiffModal } from "@/components/ApplyDiffModal";
import { MultiApplyDiffModal } from "@/components/MultiApplyDiffModal";

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

const filterNode = (node: FileNode, searchTerm: string): FileNode | null => {
  const term = searchTerm.toLowerCase();
  const isMatch = node.name.toLowerCase().includes(term);

  // Case 1: It's a file. Return it if it matches, otherwise null.
  if (!node.children) {
    return isMatch ? node : null;
  }

  // Case 2: It's a directory. If its name matches, return the whole sub-tree.
  // This allows a user to find a folder and see all its contents.
  if (isMatch) {
    return node;
  }

  // Case 3: Directory name doesn't match. Filter its children recursively.
  const filteredChildren = node.children
    .map((child) => filterNode(child, searchTerm))
    .filter(Boolean) as FileNode[];

  // If any children matched, return this directory with only the matching children.
  if (filteredChildren.length > 0) {
    return { ...node, children: filteredChildren };
  }

  return null;
};

// --- HÀM LỌC MỚI: Chỉ giữ lại các file có vùng loại trừ ---
const filterForExcludedFiles = (
  node: FileNode,
  metadataCache: Record<string, any>
): FileNode | null => {
  // Trường hợp 1: Node là file
  if (!node.children) {
    const meta = metadataCache[node.path];
    const hasExclusions = meta?.excluded_ranges?.length > 0;
    return hasExclusions ? node : null;
  }

  // Trường hợp 2: Node là thư mục
  const filteredChildren = node.children
    .map((child) => filterForExcludedFiles(child, metadataCache))
    .filter(Boolean) as FileNode[];

  // Nếu thư mục này chứa file bị loại trừ, giữ lại thư mục
  if (filteredChildren.length > 0) {
    return { ...node, children: filteredChildren };
  }

  return null;
};

// --- HÀM LỌC MỚI: Chỉ giữ lại các file có thay đổi Git ---
const filterForChangedFiles = (
  node: FileNode,
  changedPaths: Set<string>
): FileNode | null => {
  // Trường hợp 1: Node là file
  if (!node.children) {
    return changedPaths.has(node.path) ? node : null;
  }

  // Trường hợp 2: Node là thư mục
  const filteredChildren = node.children
    .map((child) => filterForChangedFiles(child, changedPaths))
    .filter(Boolean) as FileNode[];

  if (filteredChildren.length > 0) {
    return { ...node, children: filteredChildren };
  }
  return null;
};

// --- HÀM LỌC MỚI: Chỉ giữ lại các file đã áp dụng patch ---
const filterForPatchedFiles = (
  node: FileNode,
  patchedPaths: Set<string>
): FileNode | null => {
  // Trường hợp 1: Node là file
  if (!node.children) {
    return patchedPaths.has(node.path) ? node : null;
  }

  // Trường hợp 2: Node là thư mục
  const filteredChildren = node.children
    .map((child) => filterForPatchedFiles(child, patchedPaths))
    .filter(Boolean) as FileNode[];

  if (filteredChildren.length > 0) {
    return { ...node, children: filteredChildren };
  }

  return null;
};

export function GroupEditorPanel() {
  const { t } = useTranslation();
  // <-- Đổi tên component
  const {
    saveEditingGroup,
    toggleEditingPath,
    setCrossLinkingEnabled,
    selectAllFiles,
    deselectAllFiles,
    applyVirtualPatch,
    applyMultiFilePatch,
    clearAllVirtualPatches,
  } = useAppActions();

  const {
    group,
    fileTree,
    isSaving,
    fileMetadataCache,
    tempSelectedPaths,
    isCrossLinkingEnabled,
    gitStatus,
    virtualPatches,
  } = useAppStore(
    useShallow((state) => ({
      group: state.groups.find((g) => g.id === state.editingGroupId),
      fileTree: state.fileTree,
      isSaving: state.isUpdatingGroupId === state.editingGroupId,
      fileMetadataCache: state.fileMetadataCache,
      tempSelectedPaths: state.tempSelectedPaths,
      isCrossLinkingEnabled: state.isCrossLinkingEnabled,
      gitStatus: state.gitStatus,
      virtualPatches: state.virtualPatches,
    }))
  );

  const [showOnlyExcluded, setShowOnlyExcluded] = useState(false);
  const [showOnlyChanged, setShowOnlyChanged] = useState(false);
  const [showOnlyPatched, setShowOnlyPatched] = useState(false);
  const [isMultiDiffModalOpen, setIsMultiDiffModalOpen] = useState(false);
  const [isResetAllConfirmOpen, setIsResetAllConfirmOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [diffModalFile, setDiffModalFile] = useState<string | null>(null);

  const changedFilesSet = useMemo(() => {
    if (!gitStatus || !gitStatus.files) {
      return new Set<string>();
    }
    return new Set(Object.keys(gitStatus.files));
  }, [gitStatus]);

  const hasAnyExclusions = useMemo(() => {
    if (!fileMetadataCache) return false;
    return Object.values(fileMetadataCache).some(
      (meta) => (meta.excluded_ranges?.length ?? 0) > 0
    );
  }, [fileMetadataCache]);

  const patchedFilesSet = useMemo(() => {
    return new Set(virtualPatches.keys());
  }, [virtualPatches]);

  const hasAnyPatches = useMemo(
    () => patchedFilesSet.size > 0,
    [patchedFilesSet]
  );

  const handleTogglePath = useCallback(
    (toggledNode: FileNode, isSelected: boolean) => {
      toggleEditingPath(toggledNode, isSelected);
    },
    [toggleEditingPath]
  );

  const filteredFileTree = useMemo(() => {
    if (!fileTree || !fileMetadataCache) return null;

    let tree: FileNode | null = fileTree;

    // 0. Lọc theo trạng thái "chỉ hiển thị file có patch"
    if (showOnlyPatched && tree) {
      tree = filterForPatchedFiles(tree, patchedFilesSet);
    }

    // 1. Lọc theo trạng thái "chỉ hiển thị file có thay đổi"
    if (showOnlyChanged && tree) {
      tree = filterForChangedFiles(tree, changedFilesSet);
    }

    // 2. Lọc theo trạng thái "chỉ hiển thị file bị loại trừ"
    if (tree && showOnlyExcluded) {
      const excludedTree = filterForExcludedFiles(tree, fileMetadataCache);
      tree = excludedTree;
    }

    // 3. Áp dụng bộ lọc tìm kiếm
    if (tree && searchTerm.trim()) {
      tree = filterNode(tree, searchTerm);
    }

    return tree;
  }, [
    fileTree,
    fileMetadataCache,
    searchTerm,
    showOnlyExcluded,
    showOnlyChanged,
    showOnlyPatched,
    patchedFilesSet,
    changedFilesSet,
  ]);

  if (!group || !fileTree || tempSelectedPaths === null) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between p-4 border-b shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">
            {t("groupEditor.title", { name: group.name })}
          </h1>
          <p className="text-muted-foreground">
            {t("groupEditor.description")}
          </p>
        </div>
        <div className="flex flex-shrink-0 gap-2 ml-4">
          <Button onClick={saveEditingGroup} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isSaving ? t("common.saving") : t("common.saveChanges")}
          </Button>
        </div>
      </header>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b shrink-0 bg-muted/50">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={selectAllFiles}>
            <CheckCheck className="mr-2 h-4 w-4" />
            {t("groupEditor.selectAll")}
          </Button>
          <Button variant="outline" size="sm" onClick={deselectAllFiles}>
            <XCircle className="mr-2 h-4 w-4" />
            {t("groupEditor.deselectAll")}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMultiDiffModalOpen(true)}
                >
                  <FilePlus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("groupEditor.applyMultiDiffTooltip")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={patchedFilesSet.size === 0}
                  onClick={() => setIsResetAllConfirmOpen(true)}
                >
                  <Undo className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("groupEditor.resetAllPatchesTooltip")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="cross-linking-toggle"
            checked={isCrossLinkingEnabled}
            onCheckedChange={setCrossLinkingEnabled}
          />
          <Label
            htmlFor="cross-linking-toggle"
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            {isCrossLinkingEnabled ? (
              <Link className="h-4 w-4" />
            ) : (
              <Link2Off className="h-4 w-4" />
            )}
            {t("groupEditor.autoSelectLinked")}
          </Label>
        </div>
      </div>
      {/* Search Bar */}
      <div className="p-2 border-b shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("groupEditor.searchPlaceholder")}
            className="pl-8 pr-[7.5rem]" // Tăng padding cho 3 nút
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center">
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-7 w-7",
                      showOnlyExcluded && "bg-accent text-accent-foreground"
                    )}
                    onClick={() => setShowOnlyExcluded(!showOnlyExcluded)}
                    disabled={!hasAnyExclusions}
                  >
                    <Scissors className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {showOnlyExcluded
                      ? t("groupEditor.unfilterExcludedTooltip")
                      : t("groupEditor.filterExcludedTooltip")}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-7 w-7",
                      showOnlyChanged && "bg-accent text-accent-foreground"
                    )}
                    onClick={() => setShowOnlyChanged(!showOnlyChanged)}
                    disabled={changedFilesSet.size === 0}
                  >
                    <GitMerge className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {showOnlyChanged
                      ? t("groupEditor.unfilterChangedTooltip")
                      : t("groupEditor.filterChangedTooltip")}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-7 w-7",
                      showOnlyPatched && "bg-accent text-accent-foreground"
                    )}
                    onClick={() => setShowOnlyPatched(!showOnlyPatched)}
                    disabled={!hasAnyPatches}
                  >
                    <FileDiff className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {showOnlyPatched
                      ? t("groupEditor.unfilterPatchedTooltip")
                      : t("groupEditor.filterPatchedTooltip")}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full p-4">
          {filteredFileTree ? (
            <FileTreeView
              node={filteredFileTree}
              selectedPaths={tempSelectedPaths}
              onToggle={handleTogglePath}
              gitStatus={gitStatus?.files ?? null}
              onOpenDiffModal={setDiffModalFile}
            />
          ) : (
            <div className="text-center text-muted-foreground p-4">
              {showOnlyPatched
                ? t("groupEditor.noPatchedFiles")
                : showOnlyChanged
                ? t("groupEditor.noChangedFiles")
                : showOnlyExcluded
                ? t("groupEditor.noExcludedFiles")
                : searchTerm
                ? t("groupEditor.noSearchResults", { searchTerm })
                : t("groupEditor.noExcludedFiles")}
            </div>
          )}
        </ScrollArea>
      </main>
      <ApplyDiffModal
        isOpen={!!diffModalFile}
        onClose={() => setDiffModalFile(null)}
        filePath={diffModalFile}
        onApply={async (filePath, diff) => {
          await applyVirtualPatch(filePath, diff);
          setDiffModalFile(null);
        }}
      />
      <MultiApplyDiffModal
        isOpen={isMultiDiffModalOpen}
        onClose={() => setIsMultiDiffModalOpen(false)}
        onApply={(diff) => {
          applyMultiFilePatch(diff);
          setIsMultiDiffModalOpen(false);
        }}
      />
      <AlertDialog
        open={isResetAllConfirmOpen}
        onOpenChange={setIsResetAllConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("groupEditor.resetAllPatchesDialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("groupEditor.resetAllPatchesDialog.description", {
                count: patchedFilesSet.size,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={clearAllVirtualPatches}
              className="bg-destructive hover:bg-destructive/90"
            >
              {t("groupEditor.resetAllPatchesDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
