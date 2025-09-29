import { ArrowUpRightIcon } from "@heroicons/react/16/solid";
import Link from "next/link";

export default function HomePage() {
	return (
		<main className="flex flex-1 flex-col justify-center text-center">
      		<div className="mx-auto mb-1 text-4xl mb-2">
      		  🌳
      		</div>
			<h1 className="mb-1 text-2xl font-bold">damian</h1>
			<p className="text-fd-muted-foreground">
				the sql first framework
			</p>
			<p className="mt-8">
				<Link
					href="/docs/"
					className="text-fd-foreground font-semibold border-white"
				>
					Get started <ArrowUpRightIcon className="size-4 inline" />
				</Link>{" "}
			</p>
		</main>
	);
}
