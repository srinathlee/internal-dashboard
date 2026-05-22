"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/hooks/use-async";
import { useSubadminMutations } from "@/lib/hooks/use-subadmins";

interface MessageRepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repId: string;
  repName: string;
}

/** Sends an in-app message to a rep (POST /subadmins/:id/message). */
export function MessageRepDialog({
  open,
  onOpenChange,
  repId,
  repName,
}: MessageRepDialogProps) {
  const { message: sendMessage } = useSubadminMutations();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const canSend = subject.trim().length > 0 && body.trim().length > 0 && !sending;

  const reset = () => {
    setSubject("");
    setBody("");
    setSending(false);
  };

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      await sendMessage(repId, {
        channel: "in_app",
        subject: subject.trim(),
        body: body.trim(),
      });
      toast.success("Message sent", { description: `Delivered to ${repName}` });
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error("Couldn't send message", { description: errorMessage(err) });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Message {repName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="msg-subject">Subject</Label>
            <Input
              id="msg-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Focus on follow-ups"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="msg-body">Message</Label>
            <Textarea
              id="msg-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message…"
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!canSend}>
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
            Send message
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
