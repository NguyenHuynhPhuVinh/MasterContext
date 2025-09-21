// src/components/Sidebar.tsx
import { FolderKanban, Shapes, Settings, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const mainNavItems = [
  { key: "project", text: "Dự án", icon: FolderKanban, active: true },
  { key: "grouping", text: "Phân nhóm", icon: Shapes, active: false },
  // Thêm vài mục để test cuộn
  // { key: 'item3', text: 'Mục 3', icon: LayoutDashboard, active: false },
  // { key: 'item4', text: 'Mục 4', icon: LayoutDashboard, active: false },
  // { key: 'item5', text: 'Mục 5', icon: LayoutDashboard, active: false },
  // { key: 'item6', text: 'Mục 6', icon: LayoutDashboard, active: false },
];
const secondaryNavItems = [
  { key: "settings", text: "Cài đặt", icon: Settings, active: false },
];

export function Sidebar() {
  return (
    <TooltipProvider delayDuration={0}>
      {/* --- FIX & CẢI TIẾN: Layout flex-col, w-full h-full --- */}
      <aside className="flex h-full w-full flex-col bg-muted/40">
        {/* 1. HEADER (Cố định, không cuộn) */}
        <div className="flex h-16 shrink-0 items-center border-b px-6">
          <a href="#" className="flex items-center gap-2 font-semibold">
            <LayoutDashboard className="h-6 w-6" />
            <span className="font-bold">Master Context</span>
          </a>
        </div>

        {/* 2. VÙNG NỘI DUNG CHÍNH (Linh hoạt và có thể cuộn) */}
        <div className="flex-1 overflow-y-auto">
          <nav className="flex flex-col gap-1 p-4">
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
        </div>

        {/* 3. FOOTER (Cố định ở dưới cùng) */}
        <div className="mt-auto shrink-0 border-t p-4">
          <nav className="flex flex-col gap-1">
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
      </aside>
    </TooltipProvider>
  );
}
