// src/components/InlineEditingInputs.tsx
import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Folder as FolderIcon, ListChecks } from "lucide-react";

interface InlineProfileInputProps {
  defaultValue: string;
  onConfirm: (newValue: string) => void;
  onCancel: () => void;
}

interface InlineGroupInputProps {
  defaultValue: string;
  onConfirm: (newValue: string) => void;
  onCancel: () => void;
}

export function InlineProfileInput({
  defaultValue,
  onConfirm,
  onCancel,
}: InlineProfileInputProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onConfirm(value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => onCancel();

  return (
    <div className="flex items-center gap-2 p-2">
      <FolderIcon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="h-7 text-sm"
        placeholder={t("inlineInputs.profilePlaceholder")}
      />
    </div>
  );
}

export function InlineGroupInput({
  defaultValue,
  onConfirm,
  onCancel,
}: InlineGroupInputProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onConfirm(value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => onCancel();

  return (
    <div className="flex items-center gap-2 p-2 rounded-md">
      <ListChecks className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="h-7 text-sm"
        placeholder={t("inlineInputs.groupPlaceholder")}
      />
    </div>
  );
}
