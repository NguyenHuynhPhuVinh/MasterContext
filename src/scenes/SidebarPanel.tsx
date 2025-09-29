// src/scenes/SidebarPanel.tsx
import { useSidebarPanel } from "@/hooks/useSidebarPanel";
import { useTranslation } from "react-i18next";
import { GroupManager } from "@/components/GroupManager";
import { Button } from "@/components/ui/button";
import { InlineGroupInput } from "@/components/InlineEditingInputs";
import { Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export function SidebarPanel() {
  const { t } = useTranslation();
  const {
    inlineEditingGroup,
    handleStartCreateGroup,
    handleStartRenameGroup,
    onCancelGroupEdit,
    onGroupSubmitInline,
  } = useSidebarPanel();

  return (
    <div className="flex flex-col h-full bg-card">
      <header className="flex items-center justify-between p-4 border-b flex-shrink-0">
        <h1 className="text-xl font-bold">{t("sidebarPanel.groups")}</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={handleStartCreateGroup}
          disabled={!!inlineEditingGroup}
        >
          <Plus className="mr-2 h-4 w-4" /> {t("sidebarPanel.createGroup")}
        </Button>
      </header>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-1">
          <GroupManager
            inlineEditingGroup={inlineEditingGroup}
            onStartRename={handleStartRenameGroup}
            onConfirmRename={onGroupSubmitInline}
            onCancelEdit={onCancelGroupEdit}
          />

          {inlineEditingGroup?.mode === "create" && (
            <InlineGroupInput
              key="creating-group"
              defaultValue=""
              onConfirm={onGroupSubmitInline}
              onCancel={onCancelGroupEdit}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
