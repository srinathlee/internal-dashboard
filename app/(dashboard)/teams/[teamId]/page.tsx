import { TeamDetailScreen } from "@/components/teams/team-detail-screen";

interface TeamDetailPageProps {
  params: { teamId: string };
}

/**
 * Dynamic team route. Validation that the team actually exists is
 * deferred to the API call inside TeamDetailScreen — surfacing a 404
 * from the backend is more accurate than hard-coding a static list of
 * valid team IDs against the old mock data.
 */
export default function TeamDetailPage({ params }: TeamDetailPageProps) {
  return <TeamDetailScreen teamId={params.teamId} />;
}
