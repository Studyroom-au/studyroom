import Link from "next/link";
import { getAllPosts } from "../../lib/posts";

export const dynamic = "force-static";

export default async function BlogPage() {
  const posts = await getAllPosts();

  return (
    <div className="px-4 pb-16 pt-12 md:px-6 md:pt-16">
      <div className="mx-auto max-w-6xl space-y-8 rounded-3xl bg-[color:var(--card)] p-10 shadow-sm ring-1 ring-slate-200">
        <div className="inline-flex items-center rounded-full bg-white/80 px-3 py-2 text-xs font-semibold text-[color:var(--brand)] shadow-sm ring-1 ring-slate-200">
          Blog
        </div>
        <h1 className="text-4xl font-bold leading-tight text-[color:var(--ink)] md:text-5xl">
          Calm study tips, literacy help, and support for anxious and neurodivergent learners.
        </h1>
        <p className="text-lg text-slate-700 md:max-w-3xl">
          Short, practical articles you can actually use at home.
        </p>

        {posts.length === 0 ? (
          <div className="rounded-2xl bg-white/80 p-6 text-sm text-slate-600 ring-1 ring-slate-200">
            No posts yet.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="flex h-full flex-col rounded-2xl bg-white/80 p-5 ring-1 ring-slate-200"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {new Date(post.date).toLocaleDateString("en-AU")}
                </p>
                <h2 className="mt-1 text-base font-semibold text-[color:var(--ink)]">
                  <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                </h2>
                <p className="mt-2 flex-1 text-sm text-slate-600">{post.description}</p>

                <div className="mt-4">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="text-sm font-semibold text-[color:var(--brand)] hover:underline"
                  >
                    Read article →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
