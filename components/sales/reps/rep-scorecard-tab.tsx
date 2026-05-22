"use client";

import { Card } from "@/components/ui/card";
import { ScorecardBoardView } from "@/components/sales/scorecard/scorecard-board";
import { errorMessage } from "@/lib/hooks/use-async";
import { useUserScorecard } from "@/lib/hooks/use-scorecard";

/**
 * Scorecard tab — overall score summary + per-metric breakdown for one rep.
 * Reuses the shared ScorecardBoardView (same renderer as the personal and
 * admin scorecard screens).
 */
export function RepScorecardTab({ repId }: { repId: string }) {
  const board = useUserScorecard(repId);

  if (board.isLoading && !board.data) {
    return <Card className="h-72 animate-pulse" />;
  }
  if (board.error) {
    return (
      <Card className="p-8 text-center text-sm text-rose-600 dark:text-rose-400">
        Couldn&apos;t load scorecard: {errorMessage(board.error)}
      </Card>
    );
  }
  if (!board.data) {
    return (
      <Card className="p-10 text-center text-sm text-zinc-500">
        No scorecard available for this rep.
      </Card>
    );
  }

  return <ScorecardBoardView board={board.data} />;
}
