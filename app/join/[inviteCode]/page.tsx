import JoinMemoryMapClient from "./JoinMemoryMapClient";

export default async function JoinPage({ params }: { params: Promise<{ inviteCode: string }> }) {
  const { inviteCode } = await params;
  return <JoinMemoryMapClient inviteCode={inviteCode.toUpperCase()} />;
}
