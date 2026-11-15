"use client";

import { useParams } from "next/navigation";
import { AgentPanel } from "@/components/agent-panel";
import { AppFrame } from "@/components/app-frame";
import { SheetStage } from "@/components/sheet-stage";

export default function SheetPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  return (
    <AppFrame side={<AgentPanel sheetId={id} />}>
      <SheetStage sheetId={id} />
    </AppFrame>
  );
}
