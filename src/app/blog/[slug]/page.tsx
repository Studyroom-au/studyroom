import type { Metadata } from "next";
import Link from "next/link";
import { getPostBySlug } from "../../../lib/posts";

export const dynamic = "force-dynamic";

type BlogPostParams = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: BlogPostParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) return { title: "Post not found — Studyroom Australia" };

  const SITE_URL = (process.env.NEXT_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
  const canonical = SITE_URL ? `${SITE_URL}/blog/${post.slug}` : undefined;

  return {
    title: `${post.title} — Studyroom Australia`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      authors: post.author ? [post.author] : ["Studyroom"],
      ...(canonical ? { url: canonical } : {}),
    },
    ...(canonical ? { alternates: { canonical } } : {}),
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: BlogPostParams;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return (
      <div className="px-4 py-20">
        <div className="mx-auto max-w-3xl space-y-3">
          <p className="text-sm text-[color:var(--muted)]">Post not found.</p>
          <Link
            href="/blog"
            className="text-[color:var(--brand)] underline text-sm font-semibold"
          >
            Back to blog
          </Link>
        </div>
      </div>
    );
  }

  const SITE_URL = (process.env.NEXT_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
  const canonical = SITE_URL ? `${SITE_URL}/blog/${post.slug}` : undefined;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    author: { "@type": "Person", name: post.author ?? "Studyroom" },
    publisher: { "@type": "Organization", name: "Studyroom Australia" },
    datePublished: post.date,
    ...(canonical ? { url: canonical } : {}),
  };
  const jsonLdString = JSON.stringify(jsonLd).replace(/</g, "\\u003c");

  return (
    <div className="px-4 pb-16 pt-12 md:px-6 md:pt-16">
      <div className="mx-auto max-w-3xl space-y-6">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString }}
        />

        <Link
          href="/blog"
          className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand)]"
        >
          ← Back to blog
        </Link>

        <h1 className="text-3xl font-bold leading-tight text-[color:var(--ink)] md:text-4xl">
          {post.title}
        </h1>

        <article
          className="prose prose-sm max-w-none prose-headings:text-[color:var(--ink)] prose-p:text-slate-700 prose-li:text-slate-700 prose-a:text-[color:var(--brand)]"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />
      </div>
    </div>
  );
}
