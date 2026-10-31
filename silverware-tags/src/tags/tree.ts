// The tags as a tree by "/": `project/alpha` under `project`, which is a node
// whether a tag of that name is used or not. Each node counts its own uses and
// those of everything under it.

export type TagNode = {
  // The whole name (`project/alpha`) and its last level (`alpha`)
  readonly name: string;
  readonly label: string;
  // Uses of this tag itself (none: a level only), and with everything under it
  readonly own: number;
  readonly total: number;
  readonly children: readonly TagNode[];
};

/** The tree of tags counted by name, each level sorted by name */
export function tagTree(counts: ReadonlyMap<string, number>): TagNode[] {
  type Building = { name: string; label: string; own: number; children: Map<string, Building> };
  const root = new Map<string, Building>();
  for (const [name, count] of counts) {
    let level = root;
    const parts = name.split("/");
    parts.forEach((label, i) => {
      const whole = parts.slice(0, i + 1).join("/");
      let node = level.get(label);
      if (!node) {
        node = { name: whole, label, own: 0, children: new Map() };
        level.set(label, node);
      }
      if (i === parts.length - 1) node.own += count;
      level = node.children;
    });
  }
  const done = (level: Map<string, Building>): TagNode[] =>
    [...level.values()]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((node) => {
        const children = done(node.children);
        return { name: node.name, label: node.label, own: node.own, total: node.own + children.reduce((sum, child) => sum + child.total, 0), children };
      });
  return done(root);
}

/** The tree cut to the nodes whose name holds `query` (ignoring case) and what is above them */
export function filterTree(nodes: readonly TagNode[], query: string): TagNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...nodes];
  return nodes.flatMap((node): TagNode[] => {
    if (node.name.toLowerCase().includes(q)) return [node];
    const children = filterTree(node.children, q);
    return children.length ? [{ ...node, children }] : [];
  });
}
