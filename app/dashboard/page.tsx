import type { Metadata } from "next";
import DashboardClient from "./DashboardClient";

export const metadata: Metadata = {
  title: "Your MemoryMaps",
  description: "Your private MemoryMap campuses.",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
