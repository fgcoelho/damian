import { docs } from "@/.source/server";
import { Icon, type IconKey } from "@/components/icon";
import { loader } from "fumadocs-core/source";

export const source = loader(docs.toFumadocsSource(), {
  baseUrl: "/docs",
  icon: (icon) => Icon({ icon: icon as IconKey }),
});
