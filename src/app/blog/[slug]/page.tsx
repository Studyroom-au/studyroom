import Link from "next/link";
import { getAllPosts, getPostBySlug } from "../../../lib/posts";

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

// 👇 Note: params is now a Promise in Next 16 app router
type BlogPostParams = Promise<{ slug: string }>;

export default async function BlogPostPage({
  params,
}: {
  params: BlogPostParams;
}) {
  // ✅ Await params before using slug
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

  return (
    <div className="px-4 pb-16 pt-12 md:px-6 md:pt-16">
      <div className="mx-auto max-w-3xl space-y-6">
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
