// src/components/Sidebar.tsx
import { FolderKanban, Shapes, Settings, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button"; // <-- Import
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // <-- Import
import { ScrollArea } from "@/components/ui/scroll-area"; // <-- Import

// Tách các mục menu chính và phụ
const mainNavItems = [
  { key: "project", text: "Dự án", icon: FolderKanban, active: true },
  { key: "grouping", text: "Phân nhóm", icon: Shapes, active: false },
];

const secondaryNavItems = [
  { key: "settings", text: "Cài đặt", icon: Settings, active: false },
];

export function Sidebar() {
  return (
    <TooltipProvider delayDuration={0}>
      <aside className="flex h-full w-64 flex-col border-r border-border bg-muted/40">
        <div className="flex h-16 items-center border-b px-6">
          <a href="#" className="flex items-center gap-2 font-semibold">
            <LayoutDashboard className="h-6 w-6" />
            <span>Master Context</span>
          </a>
        </div>

        <ScrollArea className="flex-1">
          <div className="flex flex-1 flex-col justify-between py-4">
            <nav className="grid items-start gap-1 px-4">
              {mainNavItems.map((item) => (
                <Tooltip key={item.key}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={item.active ? "secondary" : "ghost"}
                      className="w-full justify-start gap-3"
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.text}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.text}</TooltipContent>
                </Tooltip>
              ))}
            </nav>

            <nav className="mt-auto grid items-start gap-1 px-4 pt-4">
              {secondaryNavItems.map((item) => (
                <Tooltip key={item.key}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3"
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.text}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.text}</TooltipContent>
                </Tooltip>
              ))}
            </nav>
          </div>
        </ScrollArea>
      </aside>
    </TooltipProvider>
  );
}
