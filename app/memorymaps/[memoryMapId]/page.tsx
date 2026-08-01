import type { Metadata } from "next";
import CampusViewerClient from "./CampusViewerClient";

export const metadata: Metadata = { title: "MemoryMap campus" };

export default async function MemoryMapPage({ params }: { params: Promise<{ memoryMapId: string }> }) {
  const { memoryMapId } = await params;
  return <CampusViewerClient memoryMapId={memoryMapId} />;
}
