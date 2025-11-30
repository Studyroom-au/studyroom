import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";

const postsDirectory = path.join(process.cwd(), "content", "blog");

export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  description: string;
  tags?: string[];
};

export type Post = PostMeta & {
  contentHtml: string;
};

export function getPostSlugs(): string[] {
  if (!fs.existsSync(postsDirectory)) return [];
  return fs.readdirSync(postsDirectory).filter((file) => file.endsWith(".md"));
}

export async function getPostBySlug(slug?: string): Promise<Post | null> {
  // 👇 Guard against undefined slug
  if (!slug) {
    return null;
  }

  const realSlug = slug.replace(/\.md$/, "");
  const fullPath = path.join(postsDirectory, `${realSlug}.md`);

  if (!fs.existsSync(fullPath)) return null;

  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(fileContents);

  const processedContent = await remark().use(html).process(content);
  const contentHtml = processedContent.toString();

  return {
    slug: realSlug,
    title: data.title ?? realSlug,
    date: data.date ?? "",
    description: data.description ?? "",
    tags: data.tags ?? [],
    contentHtml,
  };
}


export async function getAllPosts(): Promise<PostMeta[]> {
  const slugs = getPostSlugs();

  const posts: PostMeta[] = [];

  for (const slug of slugs) {
    const post = await getPostBySlug(slug.replace(/\.md$/, ""));
    if (post) {
      posts.push({
        slug: post.slug,
        title: post.title,
        date: post.date,
        description: post.description,
        tags: post.tags,
      });
    }
  }
  return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
}
