import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type WikiNode = {
  id: string;
  path: string;
  title: string;
  type: string;
  group?: string;
  status: string;
  tags: string[];
  out: string[];
  backlinks: string[];
};

type WikiEdge = {
  source: string;
  target: string;
  kind: string;
};

type WikiGraph = {
  generatedAt: string;
  vaultRoot: string;
  nodes: WikiNode[];
  edges: WikiEdge[];
  typedRelations: WikiEdge[];
  unresolved: Array<{ source: string; target: string }>;
  unresolvedSummary: Array<{ target: string; count: number; sources: string[] }>;
  processedIssues: Array<{ source: string; reason: string }>;
  queues: {
    inbox: string[];
    needsFollowup: string[];
    stale: string[];
  };
  stats: Record<string, number>;
};

type Filters = {
  query: string;
  section: string;
  group: string;
  type: string;
  status: string;
};

type GraphScope = "global" | "local";
type GraphMode = "knowledge" | "evidence";

type LayoutNode = WikiNode & {
  x: number;
  y: number;
  degree: number;
};

type GroupLabel = {
  group: string;
  label: string;
  x: number;
  y: number;
  count: number;
  color: string;
};

const viewBox = { width: 1280, height: 760 };

const typeColors: Record<string, string> = {
  "raw-source": "#68a6a1",
  topic: "#d29a54",
  concept: "#8da2ff",
  product: "#77b56b",
  company: "#d87c70",
  person: "#c486d7",
  method: "#d5c266",
  comparison: "#82b8df",
  index: "#aeb7bd",
  log: "#8d979f",
  archive: "#697179",
  wiki: "#8da2ff",
  note: "#aeb7bd"
};

const groupPalette = [
  "#68a6a1",
  "#d29a54",
  "#8da2ff",
  "#77b56b",
  "#d87c70",
  "#c486d7",
  "#d5c266",
  "#82b8df",
  "#aeb7bd",
  "#d08b6a",
  "#8cbf7a",
  "#7ab5c5"
];

const initialFilters: Filters = {
  query: "",
  section: "all",
  group: "all",
  type: "all",
  status: "all"
};

function App() {
  const [graph, setGraph] = useState<WikiGraph | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [graphMode, setGraphMode] = useState<GraphMode>("knowledge");
  const [evidenceWikiId, setEvidenceWikiId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [graphScope, setGraphScope] = useState<GraphScope>("global");
  const [localDepth, setLocalDepth] = useState(1);
  const [showLabels, setShowLabels] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    fetch("/wiki-graph.json", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data: WikiGraph) => {
        setGraph(data);
        setSelectedId(null);
      })
      .catch((error: Error) => setLoadError(error.message));
  }, []);

  const nodeById = useMemo(() => new Map((graph?.nodes ?? []).map((node) => [node.id, node])), [graph]);
  const filterOptions = useMemo(() => {
    const nodes = (graph?.nodes ?? []).filter((node) => node.id.startsWith("wiki/"));
    return {
      sections: unique(nodes.map((node) => node.id.split("/")[0])),
      groups: unique(nodes.map((node) => node.group ?? inferFallbackGroup(node))),
      types: unique(nodes.map((node) => node.type)),
      statuses: unique(nodes.map((node) => node.status))
    };
  }, [graph]);

  const wikiFilteredNodes = useMemo(() => {
    if (!graph) return [];
    const needle = filters.query.trim().toLowerCase();
    return graph.nodes.filter((node) => {
      const section = node.id.split("/")[0];
      const group = node.group ?? inferFallbackGroup(node);
      const searchable = [node.title, node.path, node.type, node.status, group, ...node.tags].join(" ").toLowerCase();
      return (
        node.id.startsWith("wiki/") &&
        (filters.section === "all" || filters.section === section) &&
        (filters.group === "all" || filters.group === group) &&
        (filters.type === "all" || filters.type === node.type) &&
        (filters.status === "all" || filters.status === node.status) &&
        (needle === "" || searchable.includes(needle))
      );
    });
  }, [graph, filters]);

  const evidenceCenterId = useMemo(() => {
    if (graphMode !== "evidence") return null;
    if (evidenceWikiId && nodeById.get(evidenceWikiId)?.id.startsWith("wiki/")) return evidenceWikiId;
    if (selectedId && nodeById.get(selectedId)?.id.startsWith("wiki/")) return selectedId;
    return pickLocalCenter(wikiFilteredNodes)?.id ?? null;
  }, [evidenceWikiId, graphMode, nodeById, selectedId, wikiFilteredNodes]);

  const evidenceNodeIds = useMemo(() => {
    if (!graph || !evidenceCenterId) return new Set<string>();
    return evidenceIdsForWiki(graph, evidenceCenterId);
  }, [evidenceCenterId, graph]);

  const baseFilteredNodes = useMemo(() => {
    if (!graph) return [];
    if (graphMode === "evidence") return graph.nodes.filter((node) => evidenceNodeIds.has(node.id));
    return wikiFilteredNodes;
  }, [evidenceNodeIds, graph, graphMode, wikiFilteredNodes]);

  const activeSelectedId = useMemo(() => {
    if (graphMode === "evidence") {
      if (selectedId && baseFilteredNodes.some((node) => node.id === selectedId)) return selectedId;
      return evidenceCenterId;
    }
    if (graphScope !== "local") return selectedId;
    if (selectedId && baseFilteredNodes.some((node) => node.id === selectedId)) return selectedId;
    return pickLocalCenter(baseFilteredNodes)?.id ?? null;
  }, [baseFilteredNodes, evidenceCenterId, graphMode, graphScope, selectedId]);

  const layoutScope = graphMode === "evidence" ? "local" : graphScope;
  const layoutCenterId = graphMode === "evidence" ? evidenceCenterId : activeSelectedId;
  const filteredNodes = useMemo(
    () => graphMode === "evidence" ? baseFilteredNodes : applyGraphScope(baseFilteredNodes, graph, activeSelectedId, graphScope, localDepth),
    [baseFilteredNodes, graph, activeSelectedId, graphMode, graphScope, localDepth]
  );
  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((node) => node.id)), [filteredNodes]);
  const filteredEdges = useMemo(() => {
    if (!graph) return [];
    return graph.edges.filter((edge) => filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target));
  }, [graph, filteredNodeIds]);

  const layout = useMemo(() => buildLayout(filteredNodes, filteredEdges, layoutScope, layoutCenterId), [filteredNodes, filteredEdges, layoutScope, layoutCenterId]);
  const layoutById = useMemo(() => new Map(layout.map((node) => [node.id, node])), [layout]);
  const selected = activeSelectedId ? nodeById.get(activeSelectedId) ?? null : null;
  const evidenceCenter = evidenceCenterId ? nodeById.get(evidenceCenterId) ?? null : null;
  const evidenceButtonId = useMemo(() => {
    if (activeSelectedId && nodeById.get(activeSelectedId)?.id.startsWith("wiki/")) return activeSelectedId;
    if (selectedId && nodeById.get(selectedId)?.id.startsWith("wiki/")) return selectedId;
    return pickLocalCenter(wikiFilteredNodes)?.id ?? null;
  }, [activeSelectedId, nodeById, selectedId, wikiFilteredNodes]);
  const highlighted = useMemo(() => {
    if (!activeSelectedId || !graph) return new Set<string>();
    const ids = new Set([activeSelectedId]);
    for (const edge of filteredEdges) {
      if (edge.source === activeSelectedId) ids.add(edge.target);
      if (edge.target === activeSelectedId) ids.add(edge.source);
    }
    return ids;
  }, [graph, filteredEdges, activeSelectedId]);

  const openEvidence = (id: string) => {
    const node = nodeById.get(id);
    if (!node?.id.startsWith("wiki/")) return;
    setGraphMode("evidence");
    setEvidenceWikiId(node.id);
    setSelectedId(node.id);
    setZoom(1);
  };

  const backToKnowledge = () => {
    const centerId = evidenceCenterId;
    setGraphMode("knowledge");
    setEvidenceWikiId(null);
    setSelectedId(centerId);
    setGraphScope("global");
    setZoom(1);
  };

  const resetGraph = () => {
    setFilters(initialFilters);
    setGraphMode("knowledge");
    setEvidenceWikiId(null);
    setSelectedId(null);
    setGraphScope("global");
    setLocalDepth(1);
    setZoom(1);
  };

  const zoomByWheel = (deltaY: number) => {
    const direction = deltaY > 0 ? 0.92 : 1.08;
    setZoom((value) => clamp(value * direction, 0.55, 2.4));
  };

  if (loadError) {
    return (
      <main className="empty-state">
        <h1>Graph unavailable</h1>
        <p>{loadError}</p>
      </main>
    );
  }

  if (!graph) {
    return (
      <main className="empty-state">
        <h1>Loading graph</h1>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="left-panel">
        <header className="brand">
          <div className="brand-mark">K</div>
          <div>
            <h1>Knowledge Graph</h1>
            <p>Markdown vault, Obsidian-compatible</p>
          </div>
        </header>

        <label className="control">
          <span>Search</span>
          <input value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="page, tag, path" />
        </label>

        <FilterSelect label="Section" value={filters.section} options={filterOptions.sections} onChange={(section) => setFilters({ ...filters, section })} />
        <FilterSelect label="Group" value={filters.group} options={filterOptions.groups} onChange={(group) => setFilters({ ...filters, group })} />
        <FilterSelect label="Type" value={filters.type} options={filterOptions.types} onChange={(type) => setFilters({ ...filters, type })} />
        <FilterSelect label="Status" value={filters.status} options={filterOptions.statuses} onChange={(status) => setFilters({ ...filters, status })} />

        <div className="segmented">
          <button className={graphMode === "knowledge" ? "is-active" : ""} onClick={backToKnowledge}>Knowledge</button>
          <button
            className={graphMode === "evidence" ? "is-active" : ""}
            disabled={!evidenceButtonId}
            onClick={() => evidenceButtonId && openEvidence(evidenceButtonId)}
          >
            Evidence
          </button>
        </div>
        {graphMode === "knowledge" && (
          <div className="segmented">
            <button className={graphScope === "global" ? "is-active" : ""} onClick={() => setGraphScope("global")}>All Wiki</button>
            <button className={graphScope === "local" ? "is-active" : ""} onClick={() => setGraphScope("local")}>Neighbors</button>
          </div>
        )}

        <div className="toolbar-row">
          <button onClick={() => setShowLabels((value) => !value)}>{showLabels ? "Hide labels" : "Show labels"}</button>
          <button onClick={resetGraph}>Reset</button>
        </div>

        {graphMode === "knowledge" && graphScope === "local" && (
          <div className="zoom-row">
            <span>Depth</span>
            <input type="range" min="1" max="3" step="1" value={localDepth} onChange={(event) => setLocalDepth(Number(event.target.value))} />
          </div>
        )}

        <Stats graph={graph} visibleNodes={filteredNodes.length} visibleEdges={filteredEdges.length} />
        <QueueSummary graph={graph} nodeById={nodeById} onSelect={setSelectedId} />
      </aside>

      <section className="graph-stage">
        <GraphView
          layout={layout}
          layoutById={layoutById}
          edges={filteredEdges}
          selectedId={activeSelectedId}
          graphScope={layoutScope}
          graphMode={graphMode}
          hoveredId={hoveredId}
          highlighted={highlighted}
          showLabels={showLabels}
          zoom={zoom}
          onSelect={setSelectedId}
          onOpenEvidence={openEvidence}
          onHover={setHoveredId}
          onWheelZoom={zoomByWheel}
        />
      </section>

      <aside className="right-panel">
        <NodeInspector
          node={selected}
          graph={graph}
          nodeById={nodeById}
          graphMode={graphMode}
          evidenceCenter={evidenceCenter}
          onSelect={setSelectedId}
          onOpenEvidence={openEvidence}
          onBackToKnowledge={backToKnowledge}
        />
      </aside>
    </main>
  );
}

function GraphView({
  layout,
  layoutById,
  edges,
  selectedId,
  graphScope,
  graphMode,
  hoveredId,
  highlighted,
  showLabels,
  zoom,
  onSelect,
  onOpenEvidence,
  onHover,
  onWheelZoom
}: {
  layout: LayoutNode[];
  layoutById: Map<string, LayoutNode>;
  edges: WikiEdge[];
  selectedId: string | null;
  graphScope: GraphScope;
  graphMode: GraphMode;
  hoveredId: string | null;
  highlighted: Set<string>;
  showLabels: boolean;
  zoom: number;
  onSelect: (id: string) => void;
  onOpenEvidence: (id: string) => void;
  onHover: (id: string | null) => void;
  onWheelZoom: (deltaY: number) => void;
}) {
  const scale = 1 / zoom;
  const centerX = viewBox.width / 2;
  const centerY = viewBox.height / 2;
  const boxWidth = viewBox.width * scale;
  const boxHeight = viewBox.height * scale;
  const computedViewBox = `${centerX - boxWidth / 2} ${centerY - boxHeight / 2} ${boxWidth} ${boxHeight}`;
  const groupLabels = graphScope === "global" ? buildGroupLabels(layout) : [];

  return (
    <svg
      className="graph-svg"
      viewBox={computedViewBox}
      role="img"
      aria-label="Knowledge graph"
      onWheel={(event) => {
        event.preventDefault();
        onWheelZoom(event.deltaY);
      }}
    >
      <defs>
        <radialGradient id="nodeGlow">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.78" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="group-label-layer">
        {groupLabels.map((label) => {
          const width = Math.min(250, Math.max(92, label.label.length * 6.2 + 28));
          return (
            <g key={label.group} transform={`translate(${label.x}, ${label.y})`}>
              <rect x={-width / 2} y={-13} width={width} height={26} rx={13} stroke={label.color} />
              <text>{label.label}</text>
            </g>
          );
        })}
      </g>
      <g className="edge-layer">
        {edges.map((edge) => {
          const source = layoutById.get(edge.source);
          const target = layoutById.get(edge.target);
          if (!source || !target) return null;
          const isHot = selectedId ? edge.source === selectedId || edge.target === selectedId : false;
          return (
            <line
              key={`${edge.source}-${edge.target}`}
              className={`graph-edge ${isHot ? "is-hot" : ""}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
            />
          );
        })}
      </g>
      <g className="node-layer">
        {layout.map((node) => {
          const isSelected = node.id === selectedId;
          const isDim = Boolean(selectedId && highlighted.size > 0 && !highlighted.has(node.id));
          const isHovered = node.id === hoveredId;
          const shouldShowLabel = showLabels || isSelected || isHovered || (highlighted.has(node.id) && highlighted.size <= 18) || (graphMode === "evidence" && layout.length <= 24);
          const section = node.id.split("/")[0];
          const radius = nodeRadius(node);
          return (
            <g
              key={node.id}
              className={`graph-node is-${section} ${isSelected ? "is-selected" : ""} ${isDim ? "is-dim" : ""}`}
              transform={`translate(${node.x}, ${node.y})`}
              onClick={() => onSelect(node.id)}
              onDoubleClick={() => onOpenEvidence(node.id)}
              onMouseEnter={() => onHover(node.id)}
              onMouseLeave={() => onHover(null)}
            >
              <title>{node.title}</title>
              <circle className="node-halo" r={radius + 12} />
              <circle className="node-dot" r={radius} fill={graphScope === "global" ? nodeFill(node) : typeColors[node.type] ?? typeColors.note} />
          {shouldShowLabel && (
            <text y={radius + 18}>
              {node.title.length > 26 ? `${node.title.slice(0, 24)}...` : node.title}
            </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function NodeInspector({
  node,
  graph,
  nodeById,
  graphMode,
  evidenceCenter,
  onSelect,
  onOpenEvidence,
  onBackToKnowledge
}: {
  node: WikiNode | null;
  graph: WikiGraph;
  nodeById: Map<string, WikiNode>;
  graphMode: GraphMode;
  evidenceCenter: WikiNode | null;
  onSelect: (id: string) => void;
  onOpenEvidence: (id: string) => void;
  onBackToKnowledge: () => void;
}) {
  if (!node) {
    return (
      <section className="inspector">
        <p className="muted">Select a node</p>
      </section>
    );
  }

  const neighbors = unique([...node.out, ...node.backlinks])
    .map((id) => nodeById.get(id))
    .filter(Boolean) as WikiNode[];
  const broken = graph.unresolved.filter((item) => item.source === node.id);
  const issues = graph.processedIssues.filter((item) => item.source === node.id);
  const isWikiNode = node.id.startsWith("wiki/");
  const evidenceCount = isWikiNode ? evidenceIdsForWiki(graph, node.id).size - 1 : 0;

  return (
    <section className="inspector">
      {graphMode === "evidence" && (
        <div className="inspector-actions">
          <button onClick={onBackToKnowledge}>Back to Knowledge</button>
          {evidenceCenter && <span>{evidenceCenter.title}</span>}
        </div>
      )}
      <div className="node-title">
        <span className="type-chip" style={{ backgroundColor: typeColors[node.type] ?? typeColors.note }}>{node.type}</span>
        <h2>{node.title}</h2>
        <p>{node.path}</p>
      </div>

      {graphMode === "knowledge" && isWikiNode && (
        <div className="inspector-actions">
          <button onClick={() => onOpenEvidence(node.id)}>Evidence ({evidenceCount})</button>
        </div>
      )}

      <dl className="node-metrics">
        <div><dt>Status</dt><dd>{node.status}</dd></div>
        <div><dt>Group</dt><dd>{node.group ?? inferFallbackGroup(node)}</dd></div>
        <div><dt>Links</dt><dd>{node.out.length}</dd></div>
        <div><dt>Backlinks</dt><dd>{node.backlinks.length}</dd></div>
        <div><dt>Degree</dt><dd>{node.out.length + node.backlinks.length}</dd></div>
      </dl>

      <section className="tag-list">
        {node.tags.map((tag) => <span key={tag}>#{tag}</span>)}
      </section>

      {(broken.length > 0 || issues.length > 0) && (
        <section className="warning-box">
          <h3>Attention</h3>
          {broken.map((item) => <p key={item.target}>Broken: {item.target}</p>)}
          {issues.map((item) => <p key={item.reason}>Gate: {item.reason}</p>)}
        </section>
      )}

      <section className="neighbor-list">
        <h3>{graphMode === "evidence" ? "Evidence Links" : "Connected Pages"}</h3>
        {neighbors.length === 0 ? (
          <p className="muted">No connected pages</p>
        ) : (
          neighbors.slice(0, 18).map((neighbor) => (
            <button key={neighbor.id} onClick={() => onSelect(neighbor.id)}>
              <strong>{neighbor.title}</strong>
              <span>{neighbor.type} / {neighbor.status}</span>
            </button>
          ))
        )}
      </section>
    </section>
  );
}

function Stats({ graph, visibleNodes, visibleEdges }: { graph: WikiGraph; visibleNodes: number; visibleEdges: number }) {
  const items = [
    ["Visible", visibleNodes],
    ["Links", visibleEdges],
    ["Wiki", graph.stats.wikiPages ?? 0],
    ["Raw", graph.stats.rawSources ?? 0],
    ["Inbox", graph.stats.inbox ?? 0],
    ["Broken", graph.stats.unresolved ?? 0]
  ];

  return (
    <section className="stats-grid">
      {items.map(([label, value]) => (
        <div key={label} className="stat-card">
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </section>
  );
}

function QueueSummary({ graph, nodeById, onSelect }: { graph: WikiGraph; nodeById: Map<string, WikiNode>; onSelect: (id: string) => void }) {
  const ids = [...graph.queues.inbox, ...graph.queues.needsFollowup, ...graph.queues.stale].slice(0, 8);
  const nodes = ids.map((id) => nodeById.get(id)).filter(Boolean) as WikiNode[];
  return (
    <section className="queue-panel">
      <h2>Maintenance Queue</h2>
      {nodes.length === 0 ? (
        <p className="muted">No inbox or follow-up items</p>
      ) : (
        nodes.map((node) => (
          <button key={node.id} onClick={() => onSelect(node.id)}>
            <strong>{node.title}</strong>
            <span>{node.status}</span>
          </button>
        ))
      )}
    </section>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="control">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="all">All</option>
        {options.map((option) => (
          <option value={option} key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

type SimNode = LayoutNode & {
  vx: number;
  vy: number;
};

function buildLayout(nodes: WikiNode[], edges: WikiEdge[], scope: GraphScope, selectedId: string | null): LayoutNode[] {
  const width = viewBox.width;
  const height = viewBox.height;
  const isLocal = scope === "local";
  const degree = new Map(nodes.map((node) => [node.id, node.out.length + node.backlinks.length]));
  if (!isLocal && nodes.length > 450) return buildLargeGraphLayout(nodes, degree);
  const groups = unique(nodes.map((node) => node.group ?? inferFallbackGroup(node)));
  const groupIndex = new Map(groups.map((group, index) => [group, index]));
  const localGroupIndex = new Map<string, number>();
  const points: SimNode[] = nodes.map((node, index) => {
    const angle = index * 2.399963229728653;
    const section = node.id.split("/")[0];
    const group = node.group ?? inferFallbackGroup(node);
    const localIndex = localGroupIndex.get(group) ?? 0;
    localGroupIndex.set(group, localIndex + 1);
    const radius =
      isLocal ? 52 + Math.sqrt(index + 1) * 28 :
      section === "wiki" ? 58 + Math.sqrt(localIndex + 1) * 16 :
      section === "raw" ? 22 + Math.sqrt(localIndex + 1) * 8 :
      48 + Math.sqrt(localIndex + 1) * 10;
    const target = isLocal ? localTarget(node, index, selectedId) : clusterTarget(node, groupIndex, groups.length);
    return {
      ...node,
      degree: degree.get(node.id) ?? 0,
      x: target.x + Math.cos(angle) * radius,
      y: target.y + Math.sin(angle) * radius,
      vx: 0,
      vy: 0
    };
  });
  const byId = new Map(points.map((node) => [node.id, node]));
  const layoutEdges = edges.map((edge) => [byId.get(edge.source), byId.get(edge.target)] as const).filter(([a, b]) => a && b);
  const ticks = isLocal ? 240 : points.length > 900 ? 180 : 260;

  for (let tick = 0; tick < ticks; tick += 1) {
    const alpha = 1 - tick / ticks;
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const a = points[i];
        const b = points[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const sameGroup = (a.group ?? inferFallbackGroup(a)) === (b.group ?? inferFallbackGroup(b));
        const dist2 = Math.max(dx * dx + dy * dy, isLocal ? 90 : sameGroup ? 42 : 120);
        const force = ((isLocal ? 430 : sameGroup ? 150 : 360) * alpha) / dist2;
        const fx = dx * force;
        const fy = dy * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    for (const [a, b] of layoutEdges) {
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const target =
        isLocal ? 118 :
        a.id.startsWith("wiki/") && b.id.startsWith("wiki/") ? 92 :
        a.id.startsWith("raw/") && b.id.startsWith("raw/") ? 82 :
        178;
      const force = (distance - target) * (isLocal ? 0.018 : 0.008) * alpha;
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    for (const node of points) {
      const target = isLocal ? localTarget(node, 0, selectedId) : clusterTarget(node, groupIndex, groups.length);
      const centerPull =
        isLocal && node.id === selectedId ? 0.09 :
        isLocal ? 0.018 :
        node.id.startsWith("wiki/") ? 0.028 :
        node.id.startsWith("raw/") ? 0.038 :
        0.02;
      node.vx += (target.x - node.x) * centerPull * alpha;
      node.vy += (target.y - node.y) * centerPull * alpha;
      if (node.x < 70) node.vx += (70 - node.x) * 0.04;
      if (node.x > width - 70) node.vx -= (node.x - (width - 70)) * 0.04;
      if (node.y < 70) node.vy += (70 - node.y) * 0.04;
      if (node.y > height - 70) node.vy -= (node.y - (height - 70)) * 0.04;
      node.x += node.vx;
      node.y += node.vy;
      node.vx *= 0.76;
      node.vy *= 0.76;
    }
  }

  return points.map(({ vx: _vx, vy: _vy, ...node }) => ({
    ...node,
    x: clamp(node.x, 58, width - 58),
    y: clamp(node.y, 58, height - 58)
  }));
}

function buildLargeGraphLayout(nodes: WikiNode[], degree: Map<string, number>): LayoutNode[] {
  const groupBuckets = new Map<string, WikiNode[]>();
  for (const node of nodes) {
    const group = node.group ?? inferFallbackGroup(node);
    groupBuckets.set(group, [...(groupBuckets.get(group) ?? []), node]);
  }

  const nonWikiGroups = Array.from(groupBuckets.keys())
    .filter((group) => !group.startsWith("Wiki /"))
    .sort((a, b) => (groupBuckets.get(b)?.length ?? 0) - (groupBuckets.get(a)?.length ?? 0) || a.localeCompare(b));
  const groupCenters = new Map<string, { x: number; y: number }>();
  const ringCapacities = [12, 24, 36, 60];
  let groupCursor = 0;

  for (let ring = 0; ring < ringCapacities.length && groupCursor < nonWikiGroups.length; ring += 1) {
    const capacity = ringCapacities[ring];
    const rx = 260 + ring * 145;
    const ry = 165 + ring * 92;
    const groupsOnRing = nonWikiGroups.slice(groupCursor, groupCursor + capacity);
    groupsOnRing.forEach((group, index) => {
      const angle = (Math.PI * 2 * index) / groupsOnRing.length + ring * 0.23;
      groupCenters.set(group, {
        x: viewBox.width / 2 + Math.cos(angle) * rx,
        y: viewBox.height / 2 + Math.sin(angle) * ry
      });
    });
    groupCursor += capacity;
  }

  for (const group of nonWikiGroups.slice(groupCursor)) {
    const index = groupCenters.size;
    const angle = index * 2.399963229728653;
    groupCenters.set(group, {
      x: viewBox.width / 2 + Math.cos(angle) * 540,
      y: viewBox.height / 2 + Math.sin(angle) * 310
    });
  }

  groupCenters.set("Wiki / FlexSim", { x: viewBox.width / 2 - 35, y: viewBox.height / 2 });
  groupCenters.set("Wiki / General", { x: viewBox.width / 2 + 45, y: viewBox.height / 2 + 18 });

  return nodes.map((node) => {
    const group = node.group ?? inferFallbackGroup(node);
    const bucket = groupBuckets.get(group) ?? [node];
    const index = bucket.findIndex((candidate) => candidate.id === node.id);
    const safeIndex = Math.max(index, 0);
    const center = groupCenters.get(group) ?? { x: viewBox.width / 2, y: viewBox.height / 2 };
    const count = bucket.length;
    const spread =
      group.startsWith("Wiki /") ? 88 :
      count > 120 ? 120 :
      count > 60 ? 96 :
      count > 20 ? 74 :
      48;
    const angle = safeIndex * 2.399963229728653 + stableHash(node.id) * 0.0000007;
    const radius = count <= 1 ? 0 : spread * Math.sqrt((safeIndex + 0.5) / count);
    return {
      ...node,
      degree: degree.get(node.id) ?? 0,
      x: clamp(center.x + Math.cos(angle) * radius, 42, viewBox.width - 42),
      y: clamp(center.y + Math.sin(angle) * radius, 42, viewBox.height - 42)
    };
  });
}

function applyGraphScope(nodes: WikiNode[], graph: WikiGraph | null, selectedId: string | null, scope: GraphScope, depth: number) {
  if (scope === "global") return nodes;
  if (!graph || !selectedId) return [];
  const allowed = new Set(nodes.map((node) => node.id));
  if (!allowed.has(selectedId)) return [];

  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!allowed.has(edge.source) || !allowed.has(edge.target)) continue;
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);
    adjacency.set(edge.target, [...(adjacency.get(edge.target) ?? []), edge.source]);
  }

  const visible = new Set([selectedId]);
  let frontier = [selectedId];
  for (let level = 0; level < depth; level += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbor of adjacency.get(id) ?? []) {
        if (visible.has(neighbor)) continue;
        visible.add(neighbor);
        next.push(neighbor);
      }
    }
    frontier = next;
  }

  return nodes.filter((node) => visible.has(node.id));
}

function evidenceIdsForWiki(graph: WikiGraph, wikiId: string) {
  const ids = new Set([wikiId]);
  for (const edge of graph.edges) {
    if (edge.source === wikiId && edge.target.startsWith("raw/")) ids.add(edge.target);
    if (edge.target === wikiId && edge.source.startsWith("raw/")) ids.add(edge.source);
  }
  return ids;
}

function pickLocalCenter(nodes: WikiNode[]) {
  const knowledgeCandidates = nodes.filter((node) => node.id.startsWith("wiki/") && isDefaultLocalCandidate(node));
  if (knowledgeCandidates.length > 0) {
    return [...knowledgeCandidates].sort((a, b) => nodeDegree(b) - nodeDegree(a) || a.title.localeCompare(b.title))[0] ?? null;
  }
  const candidates = nodes.some((node) => node.id.startsWith("wiki/"))
    ? nodes.filter((node) => node.id.startsWith("wiki/"))
    : nodes;
  return [...candidates].sort((a, b) => nodeDegree(b) - nodeDegree(a) || a.title.localeCompare(b.title))[0] ?? null;
}

function isDefaultLocalCandidate(node: WikiNode) {
  const degree = nodeDegree(node);
  const label = `${node.title} ${node.tags.join(" ")}`.toLowerCase();
  return degree > 0 && degree <= 60 && !label.includes("ingest") && !label.includes("qa") && !/^autodesk flexsim \d+ help$/i.test(node.title);
}

function clusterTarget(node: WikiNode, groupIndex = new Map<string, number>(), totalGroups = 1) {
  const section = node.id.split("/")[0];
  if (section === "wiki") return { x: viewBox.width * 0.5, y: viewBox.height * 0.5 };
  if (section === "raw") return groupedTarget(node.group ?? inferFallbackGroup(node), groupIndex, totalGroups);
  return { x: viewBox.width / 2, y: viewBox.height / 2 };
}

function nodeRadius(node: LayoutNode) {
  if (node.id.startsWith("raw/")) return Math.min(6.8, 2.8 + Math.sqrt(Math.max(node.degree, 1)) * 0.8);
  return Math.min(19, 6 + Math.sqrt(Math.max(node.degree, 1)) * 2.1);
}

function nodeDegree(node: WikiNode) {
  return node.out.length + node.backlinks.length;
}

function nodeFill(node: WikiNode) {
  const group = node.group ?? inferFallbackGroup(node);
  if (node.id.startsWith("raw/") || group.startsWith("FlexSim /")) return colorForGroup(group);
  return typeColors[node.type] ?? typeColors.note;
}

function buildGroupLabels(layout: LayoutNode[]): GroupLabel[] {
  if (layout.length < 80) return [];
  const buckets = new Map<string, LayoutNode[]>();
  for (const node of layout) {
    const group = node.group ?? inferFallbackGroup(node);
    buckets.set(group, [...(buckets.get(group) ?? []), node]);
  }

  return Array.from(buckets.entries())
    .map(([group, nodes]) => ({
      group,
      label: groupLabelText(group),
      x: nodes.reduce((sum, node) => sum + node.x, 0) / nodes.length,
      y: nodes.reduce((sum, node) => sum + node.y, 0) / nodes.length,
      count: nodes.length,
      color: colorForGroup(group)
    }))
    .filter((label) => label.count >= 8)
    .sort((a, b) => b.count - a.count || a.group.localeCompare(b.group))
    .slice(0, 16);
}

function colorForGroup(group: string) {
  return groupPalette[stableHash(group) % groupPalette.length];
}

function groupLabelText(group: string) {
  const label = group.replace(/^FlexSim \/ /, "");
  return label.length > 34 ? `${label.slice(0, 32)}...` : label;
}

function groupedTarget(group: string, groupIndex: Map<string, number>, totalGroups: number) {
  const index = groupIndex.get(group) ?? 0;
  const cols = Math.max(2, Math.ceil(Math.sqrt(totalGroups * 1.65)));
  const rows = Math.max(2, Math.ceil(totalGroups / cols));
  const col = index % cols;
  const row = Math.floor(index / cols);
  const xStep = cols === 1 ? 0 : (viewBox.width - 240) / (cols - 1);
  const yStep = rows === 1 ? 0 : (viewBox.height - 180) / (rows - 1);
  return {
    x: 120 + col * xStep,
    y: 90 + row * yStep
  };
}

function localTarget(node: WikiNode, index: number, selectedId: string | null) {
  if (node.id === selectedId) return { x: viewBox.width / 2, y: viewBox.height / 2 };
  const angle = stableHash(node.id) * 0.000001 + index * 2.399963229728653;
  const radius = 120 + (stableHash(node.id) % 180);
  return {
    x: viewBox.width / 2 + Math.cos(angle) * radius,
    y: viewBox.height / 2 + Math.sin(angle) * radius
  };
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function inferFallbackGroup(node: WikiNode) {
  if (node.id.startsWith("raw/autodesk-flexsim-2026/")) return "FlexSim / Corpus";
  if (node.id.startsWith("raw/")) return "Raw / Other";
  if (node.id.startsWith("wiki/") && /flexsim/i.test(`${node.title} ${node.tags.join(" ")}`)) return "Wiki / FlexSim";
  if (node.id.startsWith("wiki/")) return "Wiki / General";
  return node.id.split("/")[0] || "Other";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

createRoot(document.getElementById("root")!).render(<App />);
