import { getAdminDb } from "@/lib/firebaseAdmin";

export type Post = {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags?: string[];
  author?: string;
  published: boolean;
  contentHtml: string;
  content: string;
};

export type PostMeta = Omit<Post, "contentHtml" | "content">;

export async function getAllPosts(): Promise<PostMeta[]> {
  try {
    const db = getAdminDb();

    const snap = await db
      .collection("blogPosts")
      .orderBy("date", "desc")
      .get();

    return snap.docs
      .filter((d) => {
        const pub = d.data().published;
        return pub === true || pub === "true" || pub === 1;
      })
      .map((d) => {
        const data = d.data() as Omit<Post, "slug">;
        return {
          slug: d.id,
          title: data.title,
          description: data.description,
          date: data.date,
          tags: data.tags,
          author: data.author,
          published: data.published,
        };
      });
  } catch {
    return [];
  }
}

export async function getPostBySlug(slug?: string): Promise<Post | null> {
  if (!slug) return null;

  try {
    const db = getAdminDb();
    const doc = await db.collection("blogPosts").doc(slug).get();
    if (!doc.exists) return null;

    const data = doc.data() as Omit<Post, "slug">;
    return { slug: doc.id, ...data };
  } catch {
    return null;
  }
}
