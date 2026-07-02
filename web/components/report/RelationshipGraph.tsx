"use client";

import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";

// Shapes we read off the full property payload from the API.
interface PropertyWeb {
  id: string;
  surveyNo: string;
  village: string;
  ownerships: { id: string; owner: { name: string }; fromDate: string; toDate: string | null }[];
  encumbrances: { id: string; lender: { name: string }; amount: number; active: boolean }[];
  disputes: { id: string; caseNo: string; status: string }[];
  inheritances: { id: string; fromParty: { name: string }; toParty: { name: string } }[];
  taxRecords: { id: string; payer: { name: string }; year: number }[];
}

// records currently highlighted (because a finding is hovered)
export function RelationshipGraph({
  property,
  highlightIds,
}: {
  property: PropertyWeb;
  highlightIds: string[] | null;
}) {
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const hi = new Set(highlightIds ?? []);

    const dim = (id: string) => (highlightIds && !hi.has(id) ? 0.35 : 1);
    const lit = (id: string) => hi.has(id);

    // center: the property
    nodes.push({
      id: "property",
      position: { x: 0, y: 0 },
      data: { label: `${property.surveyNo}\n${property.village}` },
      style: {
        background: "#1B2A41", color: "#F4EEE2", border: "none",
        borderRadius: 6, padding: 12, fontWeight: 600, whiteSpace: "pre-line",
        textAlign: "center", width: 150,
      },
    });

    const place = (i: number, total: number, radius: number) => {
      const angle = (i / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    };

    // gather satellite records into one ring
    type Sat = { id: string; label: string; color: string };
    const sats: Sat[] = [
      ...property.ownerships.map((o) => ({
        id: o.id, color: "#34435A",
        label: `Owner\n${o.owner.name}\n${o.fromDate.slice(0, 4)}–${o.toDate ? o.toDate.slice(0, 4) : "now"}`,
      })),
      ...property.encumbrances.map((e) => ({
        id: e.id, color: e.active ? "#B5532A" : "#6B7689",
        label: `Lien\n${e.lender.name}\n₹${e.amount.toLocaleString("en-IN")}${e.active ? " (active)" : ""}`,
      })),
      ...property.disputes.map((d) => ({
        id: d.id, color: "#7A1F1F", label: `Dispute\n${d.caseNo}\n${d.status}`,
      })),
      ...property.inheritances.map((inh) => ({
        id: inh.id, color: "#B8893B", label: `Inheritance\n${inh.fromParty.name}→${inh.toParty.name}`,
      })),
      ...property.taxRecords.map((t) => ({
        id: t.id, color: "#2F5D44", label: `Tax ${t.year}\n${t.payer.name}`,
      })),
    ];

    sats.forEach((s, i) => {
      const pos = place(i, sats.length, 280);
      nodes.push({
        id: s.id,
        position: pos,
        data: { label: s.label },
        style: {
          background: lit(s.id) ? s.color : "#F4EEE2",
          color: lit(s.id) ? "#fff" : "#1B2A41",
          border: `2px solid ${s.color}`,
          borderRadius: 6, padding: 8, fontSize: 11, whiteSpace: "pre-line",
          textAlign: "center", width: 130, opacity: dim(s.id),
          transition: "all 0.25s ease",
        },
      });
      edges.push({
        id: `e-${s.id}`,
        source: "property",
        target: s.id,
        animated: lit(s.id),
        style: { stroke: lit(s.id) ? s.color : "rgba(27,42,65,0.25)", strokeWidth: lit(s.id) ? 2.5 : 1.5, opacity: dim(s.id) },
        markerEnd: { type: MarkerType.ArrowClosed },
      });
    });

    return { nodes, edges };
  }, [property, highlightIds]);

  return (
    <div className="h-[460px] w-full rounded-sm border border-ink/10 bg-parchment-dark/30">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
      >
        <Background color="#1B2A41" gap={28} size={1} style={{ opacity: 0.06 }} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
