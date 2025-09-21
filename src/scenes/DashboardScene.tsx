// src/scenes/DashboardScene.tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useAppStore, useAppActions, type Group } from "@/store/appStore";

// Import UI components
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

// Schema validation cho form
const groupSchema = z.object({
  name: z.string().min(1, "Tên nhóm không được để trống"),
  description: z.string().optional(),
});
type GroupFormValues = z.infer<typeof groupSchema>;

export function DashboardScene() {
  const selectedPath = useAppStore((state) => state.selectedPath);
  const rootPath = useAppStore((state) => state.rootPath);
  const projectStats = useAppStore((state) => state.projectStats);
  const isScanning = useAppStore((state) => state.isScanning);

  const { addGroup, updateGroup } = useAppActions();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: { name: "", description: "" },
  });

  const handleOpenDialog = (group: Group | null = null) => {
    setEditingGroup(group);
    form.reset(
      group
        ? { name: group.name, description: group.description }
        : { name: "", description: "" }
    );
    setIsDialogOpen(true);
  };

  const onSubmit = (data: GroupFormValues) => {
    if (editingGroup) {
      updateGroup({ ...editingGroup, ...data });
    } else {
      addGroup({ name: data.name, description: data.description || "" });
    }
    setIsDialogOpen(false);
  };

  const handleExportProject = async () => {
    if (!rootPath) return;
    setIsExporting(true);
    try {
      const context = await invoke<string>("generate_project_context", {
        path: rootPath,
      });
      const filePath = await save({
        title: "Lưu Ngữ cảnh Dự án",
        defaultPath: "project_context.txt",
        filters: [{ name: "Text File", extensions: ["txt"] }],
      });
      if (filePath) {
        await writeTextFile(filePath, context);
        alert(`Đã lưu file thành công tại:\n${filePath}`);
      }
    } catch (error) {
      console.error("Lỗi khi xuất file:", error);
      alert(
        `Đã xảy ra lỗi khi xuất file. Vui lòng kiểm tra console.\n\nLỗi: ${error}`
      );
    } finally {
      setIsExporting(false);
    }
  };

  if (isScanning && !projectStats) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-lg text-muted-foreground">
          Đang quét dự án lần đầu...
        </p>
      </div>
    );
  }

  return (
    <>
      <ResizablePanelGroup direction="horizontal" className="h-full w-full">
        {/* === SIDEBAR === */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
          <div className="flex h-full flex-col gap-4 p-4">
            <h2 className="text-xl font-bold px-2">Thông tin Dự án</h2>
            <ProjectStatsComponent
              path={selectedPath}
              stats={projectStats}
              onExportProject={handleExportProject}
              isExporting={isExporting}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* === MAIN CONTENT === */}
        <ResizablePanel defaultSize={75}>
          <ScrollArea className="h-full">
            <div className="p-8">
              <div className="flex items-center justify-between">
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
                </div>
              </div>

              <GroupManager onEditGroup={handleOpenDialog} />
            </div>
          </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>

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
