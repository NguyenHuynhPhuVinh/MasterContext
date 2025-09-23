// src/scenes/DashboardScene.tsx
import { useDashboard } from "@/hooks/useDashboard";

// Import các component UI cần thiết
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
import { PlusCircle, ChevronDown, Edit, Trash2, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/store/appStore";
import { StatusBar } from "@/components/StatusBar"; // <-- IMPORT MỚI

export function DashboardScene() {
  // const [isSettingsOpen, setIsSettingsOpen] = useState(false); // <-- XÓA STATE
  // --- COMPONENT CHỈ CÒN LẠI VIỆC GỌI HOOK VÀ RENDER UI ---
  const {
    selectedPath,
    projectStats,
    profiles,
    activeProfile,
    isGroupDialogOpen,
    editingGroup,
    profileDialogMode,
    isProfileDeleteDialogOpen,
    groupForm,
    profileForm,
    setIsGroupDialogOpen,
    handleOpenGroupDialog,
    onGroupSubmit,
    handleOpenProfileDialog,
    setProfileDialogMode,
    onProfileSubmit,
    setIsProfileDeleteDialogOpen,
    handleConfirmDeleteProfile,
  } = useDashboard();

  return (
    <>
      <div className="flex flex-col h-full">
        {/* --- HEADER CỐ ĐỊNH --- */}
        <header className="flex items-center justify-between p-6 border-b shrink-0">
          <div>
            <h1 className="text-3xl font-bold">Phân Nhóm Ngữ Cảnh</h1>
            <p className="text-muted-foreground">
              Tạo và quản lý các nhóm ngữ cảnh cho dự án của bạn.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="min-w-[120px]">
                  <span className="truncate">{activeProfile}</span>
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Hồ sơ ngữ cảnh</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {profiles.map((profile: string) => (
                  <DropdownMenuItem
                    key={profile}
                    onClick={() =>
                      useAppStore.getState().actions.switchProfile(profile)
                    }
                    className={profile === activeProfile ? "bg-accent" : ""}
                  >
                    {profile}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleOpenProfileDialog("create")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Tạo hồ sơ mới
                </DropdownMenuItem>
                {activeProfile !== "default" && (
                  <>
                    <DropdownMenuItem
                      onClick={() => handleOpenProfileDialog("rename")}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Đổi tên hồ sơ
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setIsProfileDeleteDialogOpen(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Xóa hồ sơ
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => handleOpenGroupDialog()}>
              <PlusCircle className="mr-2 h-4 w-4" /> Tạo nhóm mới
            </Button>
          </div>
        </header>

        {/* --- VÙNG NỘI DUNG CUỘN ĐƯỢC --- */}
        <ScrollArea className="flex-1">
          <div className="p-6">
            <GroupManager onEditGroup={handleOpenGroupDialog} />
          </div>
        </ScrollArea>

        {/* --- THANH TRẠNG THÁI MỚI --- */}
        <StatusBar stats={projectStats} path={selectedPath} />
      </div>

      {/* === DIALOG TẠO/SỬA NHÓM (Không thay đổi) === */}
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
              {/* --- TRƯỜNG MỚI CHO NGÂN SÁCH TOKEN --- */}
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

      {/* --- XÓA SETTINGS DIALOG KHỎI ĐÂY --- */}

      {/* === PROFILE DIALOG === */}
      <Dialog
        open={profileDialogMode !== null}
        onOpenChange={(open) => !open && setProfileDialogMode(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {profileDialogMode === "rename"
                ? "Đổi tên hồ sơ"
                : "Tạo hồ sơ mới"}
            </DialogTitle>
            <DialogDescription>
              {profileDialogMode === "rename"
                ? "Nhập tên mới cho hồ sơ ngữ cảnh."
                : "Nhập tên cho hồ sơ ngữ cảnh mới."}
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
                      <Input
                        placeholder="Ví dụ: development, staging, production"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Tên hồ sơ chỉ được chứa chữ cái, số, dấu gạch ngang và dấu
                      gạch dưới.
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

      {/* === PROFILE DELETE DIALOG === */}
      <AlertDialog
        open={isProfileDeleteDialogOpen}
        onOpenChange={setIsProfileDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa hồ sơ</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa hồ sơ "{activeProfile}"? Hành động này
              không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteProfile}>
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
