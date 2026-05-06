import { notFound } from "next/navigation";

import { TeamDetailScreen } from "@/components/teams/team-detail-screen";
import { teams } from "@/lib/mock-data";
import type { TeamId } from "@/lib/types";

interface TeamDetailPageProps {
  params: { teamId: string };
}

const VALID_TEAM_IDS = new Set<string>(teams.map((t) => t.id));

export default function TeamDetailPage({ params }: TeamDetailPageProps) {
  if (!VALID_TEAM_IDS.has(params.teamId)) notFound();
  return <TeamDetailScreen teamId={params.teamId as TeamId} />;
}
