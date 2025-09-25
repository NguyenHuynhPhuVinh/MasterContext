// src/components/TokenLimitEditor.tsx
import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { type Group } from "@/store/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

interface TokenLimitEditorProps {
  group: Group;
  onSave: (limit?: number) => void;
}

export function TokenLimitEditor({ group, onSave }: TokenLimitEditorProps) {
  const { t } = useTranslation();
  const [limit, setLimit] = useState(group.tokenLimit?.toString() ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSave = () => {
    const num = limit.trim() === "" ? undefined : parseInt(limit, 10);
    onSave(isNaN(num as number) ? undefined : num);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSave();
      e.preventDefault();
    }
  };

  return (
    <div className="p-2 space-y-2">
      <p className="text-xs font-medium text-muted-foreground px-1">
        {t("tokenLimitEditor.limitLabel")}
      </p>
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          type="number"
          placeholder={t("tokenLimitEditor.noLimitPlaceholder")}
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8"
        />
        <Button size="icon" className="h-8 w-8" onClick={handleSave}>
          <Save className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
