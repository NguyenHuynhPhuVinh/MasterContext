// src/scenes/DashboardScene.tsx
import { useDashboard } from "@/hooks/useDashboard";

// Import các component UI cần thiết
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ProjectStats as ProjectStatsComponent } from "@/components/ProjectStats";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PlusCircle, FolderSync, RotateCw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeToggle } from "@/components/ThemeToggle"; // <-- THÊM IMPORT NÀY

export function DashboardScene() {
  // --- COMPONENT CHỈ CÒN LẠI VIỆC GỌI HOOK VÀ RENDER UI ---
  const {
    selectedPath,
    projectStats,
    isDialogOpen,
    isExporting,
    editingGroup,
    form,
    setIsDialogOpen,
    handleOpenDialog,
    onSubmit,
    handleOpenAnotherFolder,
    handleExportProject,
    handleConfirmRescan,
  } = useDashboard();

  return (
    <>
      <ResizablePanelGroup direction="horizontal" className="h-full w-full">
        {/* === SIDEBAR === */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
          <div className="flex h-full flex-col gap-4 p-6">
            {" "}
            {/* Thay đổi padding p-4 -> p-6 */}
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xl font-bold">Thông tin Dự án</h2>
              <div className="flex items-center">
                <AlertDialog>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <RotateCw className="h-5 w-5" />
                        </Button>
                      </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Quét lại dự án</p>
                    </TooltipContent>
                  </Tooltip>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Bạn có chắc chắn muốn quét lại?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Hành động này sẽ đọc lại toàn bộ cây thư mục và cập nhật
                        tất cả thống kê, bao gồm cả các nhóm đã tạo. Quá trình
                        này có thể mất một lúc đối với các dự án lớn.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Hủy</AlertDialogCancel>
                      <AlertDialogAction onClick={handleConfirmRescan}>
                        Tiếp tục
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleOpenAnotherFolder}
                    >
                      <FolderSync className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Mở dự án khác</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            <ProjectStatsComponent
              path={selectedPath}
              stats={projectStats}
              onExportProject={handleExportProject}
              isExporting={isExporting}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* === MAIN CONTENT (CÓ LAYOUT MỚI) === */}
        <ResizablePanel defaultSize={75}>
          <div className="flex flex-col h-full">
            {/* --- HEADER CỐ ĐỊNH --- */}
            <header className="flex items-center justify-between p-6 border-b">
              <div>
                <h1 className="text-3xl font-bold">Phân Nhóm Ngữ Cảnh</h1>
                <p className="text-muted-foreground">
                  Tạo và quản lý các nhóm ngữ cảnh cho dự án của bạn.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => handleOpenDialog()}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Tạo nhóm mới
                </Button>
                <ThemeToggle /> {/* <-- THÊM COMPONENT THEME TOGGLE */}
              </div>
            </header>

            {/* --- VÙNG NỘI DUNG CUỘN ĐƯỢC --- */}
            <ScrollArea className="flex-1">
              <div className="p-6">
                <GroupManager onEditGroup={handleOpenDialog} />
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* === DIALOG TẠO/SỬA NHÓM (Không thay đổi) === */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? "Chỉnh sửa nhóm" : "Tạo nhóm mới"}
            </DialogTitle>
            <DialogDescription>
              Điền thông tin chi tiết cho nhóm của bạn.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
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
                control={form.control}
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
    </>
  );
}
