import { ClubDetailView } from "@/features/clubs/club-detail-view";

export default async function ClubDetailPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  return <ClubDetailView clubId={clubId} />;
}
