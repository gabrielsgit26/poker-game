import { TableDetailView } from "@/features/tables/table-detail-view";

export default async function TableDetailPage({
  params,
}: {
  params: Promise<{ tableId: string }>;
}) {
  const { tableId } = await params;
  return <TableDetailView tableId={tableId} />;
}
