import { notFound } from "next/navigation";
import { PilotDashboard } from "../PilotDashboard";
import { isPilotRole } from "../roles";

export default async function Page({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (!isPilotRole(role)) notFound();
  return <PilotDashboard role={role} />;
}
