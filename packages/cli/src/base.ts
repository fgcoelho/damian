import { Command, Flags, type Interfaces } from "@oclif/core";
import { type DamianConfig, loadConfig, loadEnv } from "./config.js";

export type BaseFlags<T extends typeof Command> = Interfaces.InferredFlags<
  typeof BaseCommand.baseFlags & T["flags"]
>;

export abstract class BaseCommand<T extends typeof Command> extends Command {
  static baseFlags = {
    config: Flags.string({
      description: "Path to damian.config.ts",
      helpGroup: "GLOBAL",
    }),
  };

  protected flags!: BaseFlags<T>;
  protected cfg!: DamianConfig;

  public async init(): Promise<void> {
    await super.init();

    const { flags } = await this.parse({
      flags: this.ctor.flags,
      baseFlags: (super.ctor as typeof BaseCommand).baseFlags,
      args: this.ctor.args,
      strict: this.ctor.strict,
    });

    this.flags = flags as BaseFlags<T>;
    this.cfg = await loadConfig(this.flags.config);
    loadEnv(this.cfg.env);
  }

  protected async catch(err: Error & { exitCode?: number }): Promise<unknown> {
    return super.catch(err);
  }
}
