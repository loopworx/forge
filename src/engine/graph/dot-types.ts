/**
 * Parsed DOT model for the Forge Workflow Language (`.forge` files).
 *
 * This is the neutral, JSON-serializable output of `dot-parser.ts`. It captures
 * topology + identity + raw attributes as strings; typed resolution (model
 * config via `class-resolver`, context namespaces, verifier composites, budget
 * objects) happens downstream and never leaks non-string values into this model
 * so that a future Rust/ratatui TUI can consume the same structure over a
 * process boundary.
 *
 * Forge uses a self-documenting `kind=` keyword as the primary node type; the
 * Graphviz `shape` is derived from `kind` for rendering only.
 */

/** Node kinds — the Forge Workflow Language's type system. */
export type NodeKind =
  | "agent"
  | "prompt"
  | "command"
  | "human-gate"
  | "conditional"
  | "fan-out"
  | "fan-in"
  | "wait"
  | "subworkflow"
  | "start"
  | "exit";

/** Derived Graphviz shape per kind (for `dot-renderer` only). */
export const KIND_TO_SHAPE: Record<NodeKind, string> = {
  agent: "box",
  prompt: "tab",
  command: "parallelogram",
  "human-gate": "hexagon",
  conditional: "diamond",
  "fan-out": "component",
  "fan-in": "tripleoctagon",
  wait: "insulator",
  subworkflow: "house",
  start: "Mdiamond",
  exit: "Msquare",
};

/** Reverse map: Graphviz `shape` → Forge `kind` (for `shape=` alias import). */
export const SHAPE_TO_KIND: Record<string, NodeKind> = Object.fromEntries(
  Object.entries(KIND_TO_SHAPE).map(([kind, shape]) => [shape, kind as NodeKind]),
) as Record<string, NodeKind>;

/** Raw attribute map — all values are strings as written in the `.forge` file. */
export type DotAttrMap = Record<string, string>;

/** A node: id + kind + derived shape + raw attributes (incl. Forge extensions). */
export interface DotNode {
  id: string;
  kind: NodeKind;
  /** Graphviz shape derived from `kind` (rendering only). */
  shape: string;
  attrs: DotAttrMap;
}

/** An edge: from → to + raw attributes (`label`, `condition`, `weight`, `context_updates`). */
export interface DotEdge {
  from: string;
  to: string;
  attrs: DotAttrMap;
}

/** Graph-level attributes parsed from `graph [...]`. */
export interface DotGraphAttrs {
  /** All raw graph attrs as written. */
  raw: DotAttrMap;
  goal?: string;
  /** `class_defaults` is an opaque CSS-like-ish string resolved by `class-resolver`. */
  classDefaults?: string;
  maxNodeVisits?: number;
  defaultFidelity?: string;
  rankdir?: string;
}

/** A `subgraph cluster_* { ... }` group with scoped `node`/`edge`/`graph` defaults. */
export interface DotSubgraph {
  /** Cluster id, e.g. `cluster_dev` (may be empty for an anonymous `subgraph`). */
  id: string;
  label?: string;
  nodeDefaults: DotAttrMap;
  edgeDefaults: DotAttrMap;
  graphAttrs: DotAttrMap;
  nodes: DotNode[];
  edges: DotEdge[];
  subgraphs: DotSubgraph[];
}

/** A parsed `digraph` — the top-level workflow document. */
export interface Digraph {
  name: string;
  graph: DotGraphAttrs;
  /** Defaults from a top-level `node [...]` statement. */
  nodeDefaults: DotAttrMap;
  /** Defaults from a top-level `edge [...]` statement. */
  edgeDefaults: DotAttrMap;
  nodes: DotNode[];
  edges: DotEdge[];
  subgraphs: DotSubgraph[];
}

/** Content-addressed version of a `.forge` source (for execution pinning). */
export interface GraphVersion {
  /** Stable digest of the parsed structure (not the source text). */
  digest: string;
  /** Source identifier (file path or `<inline>`). */
  source: string;
}

/** Resolve the effective `kind` for a node from its raw attributes. */
export function kindFromAttrs(attrs: DotAttrMap): NodeKind {
  const kind = attrs["kind"];
  if (kind && (KIND_TO_SHAPE as Record<string, string>)[kind]) {
    return kind as NodeKind;
  }
  const shape = attrs["shape"];
  if (shape && SHAPE_TO_KIND[shape]) {
    return SHAPE_TO_KIND[shape];
  }
  // DOT default shape is `box` → Forge default kind is `agent`.
  return "agent";
}
