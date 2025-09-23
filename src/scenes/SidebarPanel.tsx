// src/scenes/SidebarPanel.tsx
import { useState, useEffect, useRef } from "react";
import { useDashboard } from "@/hooks/useDashboard";
import { GroupManager } from "@/components/GroupManager";
import { Button } from "@/components/ui/button";
// --- XÓA CÁC IMPORT DIALOG CỦA GROUP ---
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
// --- XÓA CÁC IMPORT FORM ---
import { Input } from "@/components/ui/input";
import {
  PlusCircle,
  MoreHorizontal,
  Edit,
  Trash2,
  Plus,
  FolderOpen,
  ChevronRight,
  Folder as FolderIcon,
  ListChecks,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// --- Input Inline cho Profile (giữ nguyên) ---
// ... (component InlineProfileInput ở đây)

// --- COMPONENT MỚI CHO INPUT INLINE ---
interface InlineProfileInputProps {
  defaultValue: string;
  onConfirm: (newValue: string) => void;
  onCancel: () => void;
}

function InlineProfileInput({
  defaultValue,
  onConfirm,
  onCancel,
}: InlineProfileInputProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Tự động focus và chọn toàn bộ text khi component được render
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onConfirm(value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => {
    // Hủy khi người dùng click ra ngoài
    onCancel();
  };

  return (
    <div className="flex items-center gap-2 p-2">
      <FolderIcon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="h-7 text-sm"
        placeholder="Tên hồ sơ..."
      />
    </div>
  );
}

// --- Input Inline cho Group (ĐỊNH NGHĨA Ở ĐÂY ĐỂ DÙNG CHUNG) ---
interface InlineGroupInputProps {
  defaultValue: string;
  onConfirm: (newValue: string) => void;
  onCancel: () => void;
}
function InlineGroupInput({
  defaultValue,
  onConfirm,
  onCancel,
}: InlineGroupInputProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onConfirm(value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => onCancel();

  return (
    <div className="flex items-center gap-2 p-2 rounded-md">
      <ListChecks className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="h-7 text-sm"
        placeholder="Tên nhóm..."
      />
    </div>
  );
}

export function SidebarPanel() {
  const {
    profiles,
    activeProfile,
    isProfileDeleteDialogOpen,
    deletingProfile,
    inlineEditingProfile,
    inlineEditingGroup,
    handleOpenDeleteDialog,
    handleConfirmDeleteProfile,
    switchProfile,
    handleStartCreateProfile,
    handleStartRenameProfile,
    onCancelProfileEdit,
    onProfileSubmitInline,
    handleStartCreateGroup,
    handleStartRenameGroup,
    onCancelGroupEdit,
    onGroupSubmitInline,
    setIsProfileDeleteDialogOpen,
  } = useDashboard();

  const [expandedProfiles, setExpandedProfiles] = useState<
    Record<string, boolean>
  >({ [activeProfile]: true });

  const toggleProfileExpansion = (e: React.MouseEvent, profileName: string) => {
    e.stopPropagation();
    setExpandedProfiles((prev) => ({
      ...prev,
      [profileName]: !prev[profileName],
    }));
  };

  useEffect(() => {
    setExpandedProfiles((prev) => ({ ...prev, [activeProfile]: true }));
  }, [activeProfile]);

  return (
    <>
      <div className="flex flex-col h-full bg-card">
        <header className="flex items-center justify-between p-4 border-b shrink-0">
          <h1 className="text-xl font-bold">Dự Án</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartCreateProfile}
            disabled={!!inlineEditingProfile || !!inlineEditingGroup}
          >
            <Plus className="mr-2 h-4 w-4" /> Tạo hồ sơ
          </Button>
        </header>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {profiles.map((profileName) => {
              const isExpanded = expandedProfiles[profileName] ?? false;
              const isActive = profileName === activeProfile;
              const isEditingProfile =
                inlineEditingProfile?.mode === "rename" &&
                inlineEditingProfile.name === profileName;

              if (isEditingProfile) {
                return (
                  <InlineProfileInput
                    key={`${profileName}-editing`}
                    defaultValue={profileName}
                    onConfirm={onProfileSubmitInline}
                    onCancel={onCancelProfileEdit}
                  />
                );
              }

              return (
                <div key={profileName}>
                  <div
                    onClick={() => switchProfile(profileName)}
                    className={cn(
                      "group flex items-center justify-between p-2 rounded-md cursor-pointer",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent"
                    )}
                  >
                    <div className="flex-1 flex items-center gap-2">
                      <div
                        onClick={(e) => toggleProfileExpansion(e, profileName)}
                        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
                      >
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 transition-transform",
                            isExpanded && "rotate-90"
                          )}
                        />
                      </div>
                      <FolderOpen className="h-5 w-5" />
                      <span className="font-semibold">{profileName}</span>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          onClick={(e) => e.stopPropagation()}
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-56"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* --- SỬA ACTION TẠO NHÓM MỚI --- */}
                        <DropdownMenuItem
                          onClick={() => handleStartCreateGroup(profileName)}
                          disabled={
                            !!inlineEditingGroup || !!inlineEditingProfile
                          }
                        >
                          <PlusCircle className="mr-2 h-4 w-4" />
                          <span>Tạo nhóm mới...</span>
                        </DropdownMenuItem>
                        {profileName !== "default" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                handleStartRenameProfile(profileName)
                              }
                              disabled={
                                !!inlineEditingGroup || !!inlineEditingProfile
                              }
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              <span>Đổi tên hồ sơ...</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleOpenDeleteDialog(profileName)
                              }
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Xóa hồ sơ...</span>
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {isExpanded && (
                    <div className="pl-5 pt-1">
                      <GroupManager
                        profileName={profileName}
                        inlineEditingGroup={inlineEditingGroup}
                        onStartRename={(group) =>
                          handleStartRenameGroup(profileName, group)
                        }
                        onConfirmRename={onGroupSubmitInline}
                        onCancelEdit={onCancelGroupEdit}
                      />
                      {/* --- HIỂN THỊ INPUT TẠO NHÓM MỚI --- */}
                      {inlineEditingGroup?.mode === "create" &&
                        inlineEditingGroup.profileName === profileName && (
                          <InlineGroupInput
                            key={`creating-group-in-${profileName}`}
                            defaultValue=""
                            onConfirm={onGroupSubmitInline}
                            onCancel={onCancelGroupEdit}
                          />
                        )}
                    </div>
                  )}
                </div>
              );
            })}

            {inlineEditingProfile?.mode === "create" && (
              <InlineProfileInput
                key="creating-profile"
                defaultValue=""
                onConfirm={onProfileSubmitInline}
                onCancel={onCancelProfileEdit}
              />
            )}
          </div>
        </ScrollArea>
      </div>

      {/* --- XÓA HOÀN TOÀN DIALOG CỦA GROUP --- */}

      <AlertDialog
        open={isProfileDeleteDialogOpen}
        onOpenChange={setIsProfileDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa hồ sơ</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa hồ sơ "{deletingProfile}"? Hành động này
              không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteProfile}
              className="bg-destructive hover:bg-destructive/90"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
