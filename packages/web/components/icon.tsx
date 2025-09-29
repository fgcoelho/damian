import * as icons from "@heroicons/react/16/solid";
import type { Anytype } from "lib/any";
import { createElement } from "react";

type StripIcon<T extends string> = T extends `${infer Prefix}Icon` ? Prefix : T;

export type IconKey = StripIcon<keyof typeof icons>;

export function Icon({
	icon,
	className,
}: {
	icon: IconKey | undefined;
	className?: string;
}) {
	if (!icon) {
		return;
	}

	if (!icon.endsWith("Icon")) {
		icon = `${icon}Icon` as IconKey;
	}

	if (icon && !(icon in icons)) {
		console.log(`Icon not found: ${icon}`);

		return;
	}

	if (icon in icons) {
		const iconElement = (icons as Anytype)[icon];

		return createElement(iconElement, {
			className,
		});
	}
}
