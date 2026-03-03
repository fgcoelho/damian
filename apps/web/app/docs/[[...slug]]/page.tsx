import { Icon } from "components/icon";
import { getMDXComponents } from "components/mdx-components";
import { Callout } from "fumadocs-ui/components/callout";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { createRelativeLink } from "fumadocs-ui/mdx";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/page";
import { source } from "lib/source";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { V, X } from "@/components/vx";

export default async function Page(props: PageProps<"/docs/[[...slug]]">) {
  const params = await props.params;

  const page = source.getPage(params.slug);

  if (!page) notFound();

  const { body: MDXContent, toc, full } = page.data;

  return (
    <DocsPage toc={toc} full={full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDXContent
          components={getMDXComponents({
            a: createRelativeLink(source, page),
            Icon,
            V,
            X,
            Tab,
            Tabs,
            Callout,
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(
  props: PageProps<"/docs/[[...slug]]">,
): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);

  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
