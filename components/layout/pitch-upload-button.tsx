"use client";

import { useRef, useState } from "react";
import { FileAudio, Loader2, Mic, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { isSalesMember } from "@/lib/access";
import { ApiError } from "@/lib/api/client";
import { errorMessage } from "@/lib/hooks/use-async";
import {
  useMyAcpDailyLogs,
  useMyAcpMessages,
  useMyAcpMutations,
} from "@/lib/hooks/use-accelerator";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Header control for Accelerator reps to upload a pre-recorded pitch recording
 * to one of their own daily logs.
 *
 * Mirrors {@link MessagesButton}: only sales `member` accounts mount it, and it
 * confirms enrollment via `GET /acp/me/daily-logs` — a 404 ("not an Accelerator
 * member") hides the control entirely, so it shows for enrolled reps alone. The
 * rep picks a day (default: today), chooses an audio file, and uploads it; the
 * recording then appears on that day's card in the admin's daily work log for
 * review (the admin side already plays `audio_url` via `AudioBar`).
 */
export function PitchUploadButton() {
  const auth = useAuth();
  // Gate before mounting the data hook so non-rep users never fetch.
  if (!isSalesMember(auth) || !auth.user) return null;
  return <PitchUploader />;
}

/** Largest accepted recording. Pitch audio is a few MB; cap defends the API. */
const MAX_BYTES = 25 * 1024 * 1024;

/** Local YYYY-MM-DD (not UTC) so "today" matches the rep's calendar day. */
function todayLocal(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function looksLikeAudio(file: File): boolean {
  if (file.type.startsWith("audio/")) return true;
  // Some recorders leave the MIME type blank — fall back to the extension.
  return /\.(mp3|m4a|wav|aac|ogg|oga|opus|webm|amr)$/i.test(file.name);
}

function PitchUploader() {
  // Enrollment gate keys off the PROVEN `/acp/me/messages` signal, not the
  // newer `/acp/me/daily-logs` route — the latter may not be deployed/returning
  // yet, and a 404 there would wrongly hide the control for a real rep. Both
  // 404 only for non-members, so this stays strictly accelerator-rep-only.
  const enrollment = useMyAcpMessages();
  // Best-effort: which days already carry a recording (for the "replace" hint).
  // Tolerates the daily-logs route being absent/erroring — upload still works.
  const logs = useMyAcpDailyLogs();
  const { uploadDayAudio } = useMyAcpMutations();

  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayLocal);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // A 404/401/403 from /me/messages means this rep isn't enrolled in the
  // Accelerator — there's nothing to upload against, so hide the control.
  const notAcpMember =
    enrollment.error instanceof ApiError &&
    (enrollment.error.status === 404 ||
      enrollment.error.status === 401 ||
      enrollment.error.status === 403);

  // Only render once a successful response confirms enrollment (`data` is then
  // an array, even if empty). `useAsync` keeps the last good data across a
  // transient failed refetch, so a blip won't hide an already-visible control.
  if (notAcpMember || !Array.isArray(enrollment.data)) return null;

  const today = todayLocal();

  const pickFile = (f: File | null) => {
    if (!f) {
      setFile(null);
      return;
    }
    if (!looksLikeAudio(f)) {
      toast.error("That's not an audio file", {
        description: "Upload a recording (.mp3, .m4a, .wav, …).",
      });
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("Recording is too large", {
        description: `Max ${humanSize(MAX_BYTES)} — yours is ${humanSize(f.size)}.`,
      });
      return;
    }
    setFile(f);
  };

  const reset = () => {
    setFile(null);
    setDate(todayLocal());
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleOpenChange = (next: boolean) => {
    if (uploading) return; // don't let the dialog close mid-upload
    setOpen(next);
    if (!next) reset();
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadDayAudio(date, file);
      toast.success("Pitch uploaded", {
        description: `Your coach can now hear it on ${date}.`,
      });
      void logs.refetch();
      setUploading(false);
      setOpen(false);
      reset();
    } catch (err) {
      setUploading(false);
      toast.error("Upload failed", { description: errorMessage(err) });
    }
  };

  // Which days already carry a recording — lets the rep see that a re-upload
  // will replace the existing one. Empty when the daily-logs route isn't
  // returning yet (best-effort), so the upload still works without it.
  const dayLogs = Array.isArray(logs.data) ? logs.data : [];
  const datesWithAudio = new Set(
    dayLogs.filter((l) => l.audio_url || l.audio_filename).map((l) => l.date),
  );
  const replacing = datesWithAudio.has(date);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Upload pitch recording"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
      >
        <Mic className="h-4 w-4" aria-hidden />
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload pitch recording</DialogTitle>
            <DialogDescription>
              Attach a recording to one of your daily logs. Your coach will hear
              it on that day&rsquo;s log for review.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pitch-date">Day</Label>
              <Input
                id="pitch-date"
                type="date"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
                disabled={uploading}
              />
              {replacing ? (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  This day already has a recording — uploading replaces it.
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label>Recording</Label>
              <input
                ref={inputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
                  <FileAudio
                    className="h-4 w-4 shrink-0 text-violet-500"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <span className="shrink-0 text-xs text-zinc-400">
                    {humanSize(file.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => pickFile(null)}
                    disabled={uploading}
                    aria-label="Remove file"
                    className="shrink-0 text-zinc-400 transition-colors hover:text-zinc-700 disabled:opacity-50 dark:hover:text-zinc-200"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start text-zinc-500"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4" aria-hidden />
                  Choose an audio file…
                </Button>
              )}
              <p className="text-[11px] text-zinc-400">
                Audio only, up to {humanSize(MAX_BYTES)}.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUpload}
              disabled={!file || uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="h-4 w-4" aria-hidden />
              )}
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
