export interface PopulatorDefinition {
  populate: () => Promise<void> | void;
  dependsOn?: string[];
}

export const POPULATOR_BRAND = "__damian_populator__" as const;

export class PopulatorInstance {
  readonly [POPULATOR_BRAND] = true as const;
  readonly populate: () => Promise<void> | void;
  readonly dependsOn: string[];

  constructor(def: PopulatorDefinition) {
    this.populate = def.populate;
    this.dependsOn = def.dependsOn ?? [];
  }
}

export function populator(def: PopulatorDefinition): PopulatorInstance {
  return new PopulatorInstance(def);
}
