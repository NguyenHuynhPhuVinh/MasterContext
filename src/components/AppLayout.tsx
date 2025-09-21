// src/components/AppLayout.tsx
import { Sidebar } from "./Sidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"; // <-- Import

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-full">
      {/* Panel cho Sidebar */}
      <ResizablePanel
        defaultSize={20}
        minSize={15}
        maxSize={25}
        className="min-w-[200px]"
      >
        <Sidebar />
      </ResizablePanel>

      {/* Tay cầm để kéo */}
      <ResizableHandle withHandle />

      {/* Panel cho nội dung chính */}
      <ResizablePanel defaultSize={80}>
        <main className="h-full overflow-y-auto">{children}</main>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
