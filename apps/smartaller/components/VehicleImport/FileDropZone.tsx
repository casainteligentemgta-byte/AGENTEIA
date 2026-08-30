"use client";

import { useRef, useState, type DragEvent } from "react";
import { FileText, Plus, Upload } from "lucide-react";

type Props = {
  label: string;
  hint?: string;
  multiple?: boolean;
  disabled?: boolean;
  compact?: boolean;
  onFiles: (files: File[]) => void;
};

const ACCEPT =
  "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif";

export function FileDropZone({
  label,
  hint,
  multiple = false,
  disabled = false,
  compact = false,
  onFiles,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function take(list: FileList | File[] | null) {
    if (!list) return;
    const files = Array.from(list);
    if (files.length === 0) return;
    onFiles(multiple ? files : files.slice(0, 1));
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setOver(false);
    if (disabled) return;
    take(event.dataTransfer.files);
  }

  const picker = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT}
      multiple={multiple}
      className="sr-only"
      onChange={(event) => {
        take(event.target.files);
        event.target.value = "";
      }}
    />
  );

  if (compact) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-cyan-500/50 bg-cyan-950/40 px-3 py-2 text-xs font-medium text-cyan-100 hover:border-cyan-400 hover:bg-cyan-900/40 disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" />
        {label}
        {picker}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`flex w-full flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed px-4 py-10 text-center transition ${
        over
          ? "border-cyan-400 bg-cyan-950/30"
          : "border-slate-600 bg-[#070f16] hover:border-slate-400"
      } disabled:opacity-50`}
    >
      <Upload className="h-7 w-7 text-cyan-400" />
      <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
        <FileText className="h-4 w-4 text-white" />
        {label}
      </span>
      {hint ? <span className="max-w-xs text-xs text-slate-500">{hint}</span> : null}
      {picker}
    </button>
  );
}
