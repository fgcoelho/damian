export type DependencyGraph = Map<string, string[]>;

export function topoSort(names: string[], deps: DependencyGraph): string[] {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const result: string[] = [];

  function visit(name: string, chain: string[]): void {
    if (inStack.has(name)) {
      const cycle = [...chain, name].join(" -> ");
      throw new Error(`Circular dependency detected: ${cycle}`);
    }
    if (visited.has(name)) return;

    inStack.add(name);
    for (const dep of deps.get(name) ?? []) {
      if (!names.includes(dep)) {
        throw new Error(
          `Populator "${name}" depends on "${dep}" which is not in the selected set.`,
        );
      }
      visit(dep, [...chain, name]);
    }
    inStack.delete(name);
    visited.add(name);
    result.push(name);
  }

  for (const name of names) {
    visit(name, []);
  }

  return result;
}
