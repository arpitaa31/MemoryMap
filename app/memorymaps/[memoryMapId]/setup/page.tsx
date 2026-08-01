import type { Metadata } from "next";
import CampusBuilderClient from "./CampusBuilderClient";

export const metadata: Metadata = { title: "Build your MemoryMap", description: "Shape the places inside your private MemoryMap." };

export default async function MemoryMapSetupPage({ params }: { params: Promise<{ memoryMapId: string }> }) {
  const { memoryMapId } = await params;
  return <CampusBuilderClient memoryMapId={memoryMapId} />;
}
