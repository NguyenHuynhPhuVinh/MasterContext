// src/scenes/SidebarPanel.tsx
import { useState, useCallback, useEffect } from "react";
import { useDashboard } from "@/hooks/useDashboard";
import { GroupManager } from "@/components/GroupManager";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  PlusCircle,
  MoreHorizontal,
  Edit,
  Trash2,
  Plus,
  FolderOpen,
  ChevronRight,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/store/appStore";
import { useShallow } from "zustand/react/shallow";
import { type Group } from "@/store/types";
import { cn } from "@/lib/utils";

export function SidebarPanel() {
  const {
    profiles,
    activeProfile,
    isGroupDialogOpen,
    editingGroup,
    profileDialogMode,
    isProfileDeleteDialogOpen,
    editingProfile,
    groupForm,
    profileForm,
    setIsGroupDialogOpen,
    handleOpenGroupDialog,
    onGroupSubmit,
    handleOpenProfileDialog,
    setProfileDialogMode,
    onProfileSubmit,
    setIsProfileDeleteDialogOpen,
    handleOpenDeleteDialog,
    handleConfirmDeleteProfile,
    switchProfile,
  } = useDashboard();

  const { allGroups } = useAppStore(
    useShallow((state) => ({ allGroups: state.allGroups }))
  );

  // State expandedProfiles vẫn cần thiết để quản lý việc hiển thị các nhóm
  const [expandedProfiles, setExpandedProfiles] = useState<
    Record<string, boolean>
  >({ [activeProfile]: true });

  const handleEditGroup = useCallback(
    (group: Group) => {
      if (group.id) {
        const profileOfGroup = [...allGroups.entries()].find(([, groups]) =>
          groups.some((g) => g.id === group.id)
        )?.[0];
        if (profileOfGroup && profileOfGroup !== activeProfile) {
          switchProfile(profileOfGroup).then(() => {
            handleOpenGroupDialog(group);
          });
        } else {
          handleOpenGroupDialog(group);
        }
      }
    },
    [handleOpenGroupDialog, allGroups, activeProfile, switchProfile]
  );

  const toggleProfileExpansion = (e: React.MouseEvent, profileName: string) => {
    e.stopPropagation();
    setExpandedProfiles((prev) => ({
      ...prev,
      [profileName]: !prev[profileName],
    }));
  };

  // Logic để tạo nhóm mới trong đúng hồ sơ
  const handleCreateNewGroupInProfile = (profileName: string) => {
    // Nếu hồ sơ được chọn không phải là hồ sơ đang hoạt động
    if (profileName !== activeProfile) {
      // Chuyển sang hồ sơ đó trước, sau đó mở dialog
      switchProfile(profileName).then(() => {
        handleOpenGroupDialog(null);
      });
    } else {
      // Nếu đã là hồ sơ hoạt động, chỉ cần mở dialog
      handleOpenGroupDialog(null);
    }
  };

  // Cập nhật state expanded khi hồ sơ active thay đổi
  useEffect(() => {
    setExpandedProfiles((prev) => ({ ...prev, [activeProfile]: true }));
  }, [activeProfile]);

  return (
    <>
      <div className="flex flex-col h-full bg-card">
        <header className="flex items-center justify-between p-4 border-b shrink-0">
          <h1 className="text-xl font-bold">Bảng điều khiển</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenProfileDialog("create")}
          >
            <Plus className="mr-2 h-4 w-4" /> Tạo hồ sơ
          </Button>
        </header>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {profiles.map((profileName) => {
              const isExpanded = expandedProfiles[profileName] ?? false;
              const isActive = profileName === activeProfile;
              return (
                <div key={profileName}>
                  <div
                    onClick={() => switchProfile(profileName)}
                    // --- THAY ĐỔI 2: Sửa lỗi hover trên hồ sơ đang active ---
                    className={cn(
                      "group flex items-center justify-between p-2 rounded-md cursor-pointer",
                      isActive
                        ? "bg-primary text-primary-foreground" // Nếu active, dùng màu này và không hover
                        : "hover:bg-accent" // Nếu không active, mới cho phép hover
                    )}
                  >
                    <div className="flex-1 flex items-center gap-2">
                      {/* --- THAY ĐỔI LOGIC: Nút này chỉ để mở/đóng --- */}
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
                        {/* Ngăn sự kiện click lan ra thẻ div cha */}
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
                        <DropdownMenuItem
                          onClick={() =>
                            handleCreateNewGroupInProfile(profileName)
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
                                handleOpenProfileDialog("rename", profileName)
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
                        {/* --- THAY ĐỔI 1: Đã xóa mục "Tạo hồ sơ khác..." thừa ở đây --- */}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {isExpanded && (
                    <div className="pl-5 pt-1">
                      <GroupManager
                        profileName={profileName}
                        onEditGroup={handleEditGroup}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Các Dialog không thay đổi */}
      <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? "Chỉnh sửa nhóm" : "Tạo nhóm mới"}
            </DialogTitle>
            <DialogDescription>
              Điền thông tin chi tiết cho nhóm của bạn.
            </DialogDescription>
          </DialogHeader>
          <Form {...groupForm}>
            <form
              onSubmit={groupForm.handleSubmit(onGroupSubmit)}
              className="space-y-4"
            >
              <FormField
                control={groupForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tên nhóm</FormLabel>
                    <FormControl>
                      <Input placeholder="Ví dụ: Backend APIs" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={groupForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mô tả</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Mô tả ngắn về chức năng của nhóm này..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={groupForm.control}
                name="tokenLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Giới hạn Token (Tùy chọn)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Ví dụ: 8000"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? undefined : e.target.value
                          )
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      Đặt ngân sách token để nhận cảnh báo nếu nhóm vượt quá.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    Hủy
                  </Button>
                </DialogClose>
                <Button type="submit">Lưu</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={profileDialogMode !== null}
        onOpenChange={(open) => !open && setProfileDialogMode(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {profileDialogMode === "rename"
                ? `Đổi tên hồ sơ "${editingProfile}"`
                : "Tạo hồ sơ mới"}
            </DialogTitle>
            <DialogDescription>
              {profileDialogMode === "rename"
                ? "Nhập tên mới cho hồ sơ."
                : "Nhập tên cho hồ sơ mới."}
            </DialogDescription>
          </DialogHeader>
          <Form {...profileForm}>
            <form
              onSubmit={profileForm.handleSubmit(onProfileSubmit)}
              className="space-y-4"
            >
              <FormField
                control={profileForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tên hồ sơ</FormLabel>
                    <FormControl>
                      <Input placeholder="Ví dụ: development" {...field} />
                    </FormControl>
                    <FormDescription>
                      Tên chỉ được chứa chữ cái, số, gạch ngang và gạch dưới.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    Hủy
                  </Button>
                </DialogClose>
                <Button type="submit">
                  {profileDialogMode === "rename" ? "Đổi tên" : "Tạo"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={isProfileDeleteDialogOpen}
        onOpenChange={setIsProfileDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa hồ sơ</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa hồ sơ "{editingProfile}"? Hành động này
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
