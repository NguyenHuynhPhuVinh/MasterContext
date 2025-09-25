// src/components/GroupItem.tsx
import { type Group } from "@/store/types";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  Trash2,
  Pencil,
  Download,
  ListChecks,
  Loader2,
  Link,
  ClipboardCopy,
  BrainCircuit,
  Tag,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
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
import { InlineGroupInput } from "./InlineEditingInputs";
import { TokenLimitEditor } from "./TokenLimitEditor";

interface GroupItemProps {
  group: Group;
  isLoading: boolean;
  isEditing: boolean;
  onEditContent: (group: Group) => void;
  onStartRename: (group: Group) => void;
  onConfirmRename: (newName: string) => void;
  onCancelEdit: () => void;
  onCopyContext: (group: Group) => void;
  onExport: (group: Group) => void;
  onToggleCrossSync: (group: Group, enabled: boolean) => void;
  onSaveTokenLimit: (group: Group, limit?: number) => void;
  onDelete: (group: Group) => void;
}

export function GroupItem({
  group,
  isLoading,
  isEditing,
  onEditContent,
  onStartRename,
  onConfirmRename,
  onCancelEdit,
  onCopyContext,
  onExport,
  onToggleCrossSync,
  onSaveTokenLimit,
  onDelete,
}: GroupItemProps) {
  const { t } = useTranslation();
  if (isEditing) {
    return (
      <InlineGroupInput
        key={`${group.id}-editing`}
        defaultValue={group.name}
        onConfirm={onConfirmRename}
        onCancel={onCancelEdit}
      />
    );
  }

  return (
    <div className="group flex items-center justify-between p-2 rounded-md hover:bg-accent/50">
      <div
        className="flex-1 flex items-center gap-2 cursor-pointer"
        onClick={() => onEditContent(group)}
      >
        <ListChecks className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-normal text-sm truncate">{group.name}</p>
          <p
            className={cn(
              "text-xs text-muted-foreground truncate",
              group.tokenLimit &&
                group.stats.token_count > group.tokenLimit &&
                "text-destructive font-semibold"
            )}
          >
            <BrainCircuit className="inline-block h-3 w-3 mr-1" />
            {group.stats.token_count.toLocaleString()}
            {group.tokenLimit
              ? ` / ${group.tokenLimit.toLocaleString()}`
              : ""}{" "}
            {t("groupItem.tokens")}
          </p>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => onStartRename(group)}>
            <Pencil className="mr-2 h-4 w-4" />
            <span>{t("groupItem.menu.rename")}</span>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Tag className="mr-2 h-4 w-4" />
              <span>{t("groupItem.menu.editTokenLimit")}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="p-0">
              <TokenLimitEditor
                group={group}
                onSave={(limit?: number) => onSaveTokenLimit(group, limit)}
              />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onCopyContext(group)}>
            <ClipboardCopy className="mr-2 h-4 w-4" />
            <span>{t("groupItem.menu.copyContext")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport(group)}>
            <Download className="mr-2 h-4 w-4" />
            <span>{t("groupItem.menu.exportContext")}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={group.crossSyncEnabled ?? false}
            onCheckedChange={(enabled) => onToggleCrossSync(group, enabled)}
          >
            <Link className="mr-2 h-4 w-4" />
            <span>{t("groupItem.menu.crossSync")}</span>
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                <span>{t("groupItem.menu.delete")}</span>
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("groupItem.deleteDialog.title")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("groupItem.deleteDialog.description", {
                    name: group.name,
                  })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(group)}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  {t("common.delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
