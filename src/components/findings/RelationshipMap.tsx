import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { type FindingPerson, type PersonRelationship, type Severity } from '../../types';
import { SEVERITY_COLORS, RELATIONSHIP_LABELS, getInitials } from '../../lib/utils';

interface RelationshipMapProps {
  findingPeople: FindingPerson[];
  relationships: PersonRelationship[];
  severity: Severity;
}

// Custom person node
function PersonNode({ data }: { data: {
  name: string;
  role: string | null;
  amount: number | null;
  isConvicted: boolean;
  initials: string;
  color: string;
} }) {
  const amountLabel =
    data.amount && data.amount >= 1_000_000
      ? `$${(data.amount / 1_000_000).toFixed(1)}M`
      : data.amount && data.amount >= 1_000
      ? `$${(data.amount / 1_000).toFixed(0)}K`
      : null;

  return (
    <div
      className="px-3 py-2.5 rounded-xl border-2 min-w-[140px] max-w-[180px] text-center"
      style={{
        backgroundColor: '#1a1a2e',
        borderColor: data.isConvicted ? '#EF4444' : data.color,
        boxShadow: `0 0 12px ${data.color}33`,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: data.color, border: 'none' }} />
      <div
        className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-sm font-bold text-white"
        style={{ backgroundColor: data.color + '40', border: `2px solid ${data.color}` }}
      >
        {data.initials}
      </div>
      <div className="text-white text-xs font-semibold leading-tight">{data.name}</div>
      {data.role && (
        <div className="text-gray-400 text-[10px] mt-0.5 leading-tight">{data.role}</div>
      )}
      {amountLabel && (
        <div className="mt-1.5 text-emerald-400 font-mono text-[10px] font-bold bg-emerald-400/10 rounded px-1.5 py-0.5 inline-block">
          {amountLabel}
        </div>
      )}
      {data.isConvicted && (
        <div className="mt-1 text-red-400 text-[10px] font-bold uppercase tracking-wide">
          Condenado
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: data.color, border: 'none' }} />
    </div>
  );
}

const nodeTypes: NodeTypes = { person: PersonNode };

const EDGE_STYLES: Record<string, { stroke: string; strokeDasharray?: string }> = {
  familiar: { stroke: '#EC4899', strokeDasharray: '5 3' },
  socio_comercial: { stroke: '#3B82F6' },
  politico: { stroke: '#8B5CF6' },
  empleado: { stroke: '#6B7280' },
  otro: { stroke: '#4B5563', strokeDasharray: '3 3' },
};

function layoutNodes(nodes: Node[]): Node[] {
  const cols = Math.ceil(Math.sqrt(nodes.length));
  return nodes.map((node, i) => ({
    ...node,
    position: {
      x: (i % cols) * 220 + 40,
      y: Math.floor(i / cols) * 200 + 40,
    },
  }));
}

export function RelationshipMap({ findingPeople, relationships, severity }: RelationshipMapProps) {
  const severityColor = SEVERITY_COLORS[severity];

  const nodes: Node[] = useMemo(() => {
    const raw: Node[] = findingPeople.map((fp) => ({
      id: fp.person_id,
      type: 'person',
      position: { x: 0, y: 0 },
      data: {
        name: fp.person?.name ?? 'Desconocido',
        role: fp.person?.role ?? fp.role_in_case,
        amount: fp.amount_usd,
        isConvicted: fp.is_convicted,
        initials: getInitials(fp.person?.name ?? '?'),
        color: fp.is_convicted ? '#EF4444' : severityColor,
      },
    }));
    return layoutNodes(raw);
  }, [findingPeople, severityColor]);

  const edges: Edge[] = useMemo(() => {
    const personIds = new Set(findingPeople.map((fp) => fp.person_id));
    return relationships
      .filter((r) => personIds.has(r.person_a_id) && personIds.has(r.person_b_id))
      .map((r) => {
        const style = EDGE_STYLES[r.relationship] ?? EDGE_STYLES.otro;
        return {
          id: r.id,
          source: r.person_a_id,
          target: r.person_b_id,
          label: RELATIONSHIP_LABELS[r.relationship],
          labelStyle: { fill: '#9CA3AF', fontSize: 10 },
          labelBgStyle: { fill: '#1a1a2e', fillOpacity: 0.8 },
          style: { strokeWidth: 2, ...style },
          type: 'smoothstep',
          animated: r.relationship === 'familiar',
        };
      });
  }, [relationships, findingPeople]);

  const onInit = useCallback(() => {}, []);

  // Check for "red familiar" (≥3 family edges for any node)
  const familyEdgeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    edges.forEach((e) => {
      if (relationships.find((r) => r.id === e.id)?.relationship === 'familiar') {
        counts[e.source] = (counts[e.source] ?? 0) + 1;
        counts[e.target] = (counts[e.target] ?? 0) + 1;
      }
    });
    return counts;
  }, [edges, relationships]);

  const hasFamilyNetwork = Object.values(familyEdgeCounts).some((c) => c >= 2);

  if (findingPeople.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm bg-dark-800 rounded-xl border border-dark-600">
        No hay personas registradas para este hallazgo.
      </div>
    );
  }

  return (
    <div className="relative">
      {hasFamilyNetwork && (
        <div className="absolute top-3 left-3 z-10 bg-pink-500/20 border border-pink-500/40 rounded-lg px-3 py-1.5 text-xs text-pink-400 font-semibold">
          ⚠ Red Familiar Detectada
        </div>
      )}
      <div className="h-[480px] rounded-xl overflow-hidden border border-dark-600 bg-dark-950">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onInit={onInit}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#1e2a4a"
          />
          <Controls
            style={{
              backgroundColor: '#1a1a2e',
              border: '1px solid #243358',
              borderRadius: 8,
            }}
          />
          <MiniMap
            nodeColor={() => severityColor}
            maskColor="rgba(10,10,15,0.8)"
            style={{
              backgroundColor: '#0f0f1a',
              border: '1px solid #1e2a4a',
            }}
          />
        </ReactFlow>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
        {Object.entries(EDGE_STYLES).map(([type, style]) => (
          <span key={type} className="flex items-center gap-1.5">
            <span
              className="inline-block w-6 border-t-2"
              style={{
                borderColor: style.stroke,
                borderStyle: style.strokeDasharray ? 'dashed' : 'solid',
              }}
            />
            {RELATIONSHIP_LABELS[type]}
          </span>
        ))}
      </div>
    </div>
  );
}
