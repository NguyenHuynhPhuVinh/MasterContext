// src/scenes/SidebarPanel.tsx
import { useSidebarPanel } from "@/hooks/useSidebarPanel";
import { useTranslation } from "react-i18next";
import { GroupManager } from "@/components/GroupManager";
import { Button } from "@/components/ui/button";
import {
  InlineProfileInput,
  InlineGroupInput,
} from "@/components/InlineEditingInputs";
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
import {
  PlusCircle,
  MoreHorizontal,
  Edit,
  Trash2,
  Plus,
  ChevronRight,
  Folder as FolderIcon,
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

export function SidebarPanel() {
  const { t } = useTranslation();
  const {
    profiles,
    activeProfile,
    isProfileDeleteDialogOpen,
    deletingProfile,
    inlineEditingProfile,
    inlineEditingGroup,
    expandedProfiles,
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
    toggleProfileExpansion,
  } = useSidebarPanel();

  return (
    <>
      <div className="flex flex-col h-full bg-card">
        <header className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h1 className="text-xl font-bold">{t("sidebarPanel.title")}</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartCreateProfile}
            disabled={!!inlineEditingProfile || !!inlineEditingGroup}
          >
            <Plus className="mr-2 h-4 w-4" /> {t("sidebarPanel.createProfile")}
          </Button>
        </header>

        {/* Áp dụng logic tương tự GitPanel: ScrollArea chiếm không gian còn lại */}
        <ScrollArea className="flex-1 min-h-0">
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
                      <FolderIcon className="h-5 w-5" />
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
                          <span>{t("sidebarPanel.createGroup")}</span>
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
                              <span>{t("sidebarPanel.renameProfile")}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleOpenDeleteDialog(profileName)
                              }
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>{t("sidebarPanel.deleteProfile")}</span>
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
            <AlertDialogTitle>
              {t("sidebarPanel.deleteProfileTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("sidebarPanel.deleteProfileDescription", {
                profile: deletingProfile,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteProfile}
              className="bg-destructive hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
