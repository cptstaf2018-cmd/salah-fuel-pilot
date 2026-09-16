import { notFound } from "next/navigation";
import { PilotDashboard } from "../PilotDashboard";

export default async function Page({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (role !== "admin" && role !== "station") notFound();
  return <PilotDashboard role={role} />;
}
