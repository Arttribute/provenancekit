// components/provenance/GraphFlow.tsx
"use client";

import React, { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import { Card, CardContent } from "@/components/ui/card";
import { Database, Zap, User } from "lucide-react";

export interface GraphNode {
  id: string;
  type: "resource" | "action" | "entity";
  label: string;
  data: any;
}
export interface GraphEdge {
  from: string;
  to: string;
  type: "produces" | "consumes" | "tool" | "performedBy";
}

const ResourceNodeCmp = ({ data }: any) => (
  <Card className="min-w-[220px] border-blue-200 ">
    <CardContent className="p-3">
      <div className="flex items-center gap-2 mb-2">
        <Database className="w-4 h-4 text-blue-600" />
        <span className="font-medium text-sm">Resource</span>
      </div>
      <div className="text-xs text-gray-600 dark:text-gray-300 font-mono break-all">
        {data.cid}
      </div>
      <div className="text-xs mt-1">{data.type}</div>
    </CardContent>
  </Card>
);

const ActionNodeCmp = ({ data }: any) => (
  <Card className="min-w-[200px] border-green-200 bg-green-50 dark:bg-green-950">
    <CardContent className="p-3">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-4 h-4 text-green-600" />
        <span className="font-medium text-sm">Action</span>
      </div>
      <div className="text-xs break-all">type: {data.type}</div>
      <div className="text-xs mt-1 break-all">
        at: {new Date(data.timestamp).toLocaleString()}
      </div>
    </CardContent>
  </Card>
);

const EntityNodeCmp = ({ data }: any) => (
  <Card className="min-w-[200px] border-yellow-200 bg-yellow-50 dark:bg-yellow-950">
    <CardContent className="p-3">
      <div className="flex items-center gap-2 mb-2">
        <User className="w-4 h-4 text-yellow-600" />
        <span className="font-medium text-sm">Entity</span>
      </div>
      <div className="text-xs break-all">{data.name ?? data.entityId}</div>
      <div className="text-xs mt-1">{data.role}</div>
    </CardContent>
  </Card>
);

const nodeTypes = {
  resource: ResourceNodeCmp,
  action: ActionNodeCmp,
  entity: EntityNodeCmp,
};

export function GraphFlow({
  nodes,
  edges,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
}) {
  const rfNodes: Node[] = useMemo(
    () =>
      nodes.map((n, i) => ({
        id: n.id,
        type: n.type,
        position: { x: (i % 4) * 350, y: Math.floor(i / 4) * 200 },
        data:
          n.type === "resource"
            ? { ...n.data, cid: n.data.cid ?? n.data.address?.cid }
            : n.data,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      })),
    [nodes]
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      edges.map((e, i) => ({
        id: `${e.from}-${e.to}-${i}`,
        source: e.from,
        target: e.to,
        label: e.type,
        animated: e.type === "produces",
      })),
    [edges]
  );

  return (
    <div className="h-[600px] w-full">
      <ReactFlow nodes={rfNodes} edges={rfEdges} nodeTypes={nodeTypes} fitView>
        <Background gap={20} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
