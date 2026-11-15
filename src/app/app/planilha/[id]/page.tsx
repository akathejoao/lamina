"use client";

import { useParams } from "next/navigation";
import { AgentPanel } from "@/components/agent-panel";
import { SidePortal } from "@/components/app-frame";
import { SheetStage } from "@/components/sheet-stage";

export default function SheetPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  return (
    <>
      <SheetStage sheetId={id} />
      <SidePortal>
        <AgentPanel sheetId={id} />
      </SidePortal>
    </>
  );
}
