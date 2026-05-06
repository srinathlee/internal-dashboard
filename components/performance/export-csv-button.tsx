"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface ExportCsvButtonProps {
  /** Function that builds the CSV text — called only on click so we don't pay the cost otherwise. */
  buildCsv: () => string;
  filename: string;
  disabled?: boolean;
  variant?: "default" | "outline";
}

/**
 * Generates a CSV blob and triggers a browser download.
 * Caller is responsible for permission gating; this component renders unconditionally.
 */
export function ExportCsvButton({
  buildCsv,
  filename,
  disabled,
  variant = "outline",
}: ExportCsvButtonProps) {
  const handleClick = () => {
    try {
      const csv = buildCsv();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Export ready", { description: filename });
    } catch (err) {
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={handleClick}
      disabled={disabled}
      className="h-9"
    >
      <Download className="h-4 w-4" aria-hidden />
      Export CSV
    </Button>
  );
}

/** Quote a CSV cell when it contains commas, quotes, or newlines. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCsvFrom(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines: string[] = [];
  lines.push(headers.map(csvCell).join(","));
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  return lines.join("\n");
}
