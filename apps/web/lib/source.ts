import { loader } from "fumadocs-core/source";
import { docs } from "@/.source/server";
import { Icon, type IconKey } from "@/components/icon";

export const source = loader(docs.toFumadocsSource(), {
  baseUrl: "/docs",
  icon: (icon) => Icon({ icon: icon as IconKey }),
});
