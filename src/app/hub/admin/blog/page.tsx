"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, orderBy, query, onSnapshot } from "firebase/firestore";
import { marked } from "marked";
import { db, auth } from "@/lib/firebase";

type Post = {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags?: string[];
  author?: string;
  published: boolean;
  content: string;
  contentHtml: string;
};

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .slice(0, 80);
}

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [editingPost, setEditingPost] = useState<Partial<Post> | null>(null);
  const [tagsRaw, setTagsRaw] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // Load posts (all, including drafts) client-side
  useEffect(() => {
    const q = query(collection(db, "blogPosts"), orderBy("date", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setPosts(
        snap.docs.map((d) => ({ slug: d.id, ...(d.data() as Omit<Post, "slug">) }))
      );
    });
    return () => unsub();
  }, []);

  function openEditor(post: Post) {
    setEditingPost({ ...post });
    setTagsRaw((post.tags ?? []).join(", "));
    setSlugManuallyEdited(true);
    setError(null);
  }

  function openNewPost() {
    const today = new Date().toISOString().split("T")[0];
    setEditingPost({ title: "", slug: "", description: "", author: "Studyroom", content: "", date: today, published: false });
    setTagsRaw("");
    setSlugManuallyEdited(false);
    setError(null);
  }

  function handleTitleChange(title: string) {
    setEditingPost((p) => {
      const next = { ...p, title };
      if (!slugManuallyEdited) {
        next.slug = slugify(title);
      }
      return next;
    });
  }

  const renderedPreview = useMemo(
    () => marked(editingPost?.content ?? "") as string,
    [editingPost?.content]
  );

  async function savePost() {
    if (!editingPost?.title?.trim()) { setError("Title is required."); return; }
    if (!editingPost?.content?.trim()) { setError("Content is required."); return; }

    setSaving(true);
    setError(null);

    try {
      const u = auth.currentUser;
      if (!u) throw new Error("Not signed in.");
      const idToken = await u.getIdToken();

      const payload = {
        ...editingPost,
        tagsRaw,
      };

      const res = await fetch("/api/admin/blog/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json() as { ok?: boolean; error?: string; slug?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Save failed.");

      setEditingPost(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePost(slug: string) {
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    try {
      const u = auth.currentUser;
      if (!u) return;
      const idToken = await u.getIdToken();
      await fetch("/api/admin/blog/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ slug }),
      });
    } catch (err) {
      console.error("[delete-post]", err);
    }
  }

  // ── Editor view ─────────────────────────────────────────────────────────────
  if (editingPost !== null) {
    return (
      <div style={{ paddingBottom: 80 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#82977e", marginBottom: 4 }}>
              Admin · Blog
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1a1f24", margin: 0, letterSpacing: "-0.02em" }}>
              {editingPost.slug ? "Edit Post" : "New Post"}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setEditingPost(null)}
            style={{ background: "white", color: "#456071", border: "1.5px solid #b8cad6", borderRadius: 12, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            ← Back to list
          </button>
        </div>

        {error && (
          <div style={{ background: "#fce8ee", color: "#c0445e", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Metadata fields */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Title</label>
            <input
              value={editingPost.title ?? ""}
              onChange={(e) => handleTitleChange(e.target.value)}
              style={inputStyle}
              placeholder="Post title"
            />
          </div>
          <div>
            <label style={labelStyle}>Slug</label>
            <input
              value={editingPost.slug ?? ""}
              onChange={(e) => {
                setSlugManuallyEdited(true);
                setEditingPost((p) => ({ ...p, slug: e.target.value }));
              }}
              style={inputStyle}
              placeholder="url-safe-slug"
            />
          </div>
          <div>
            <label style={labelStyle}>Description / Excerpt</label>
            <input
              value={editingPost.description ?? ""}
              onChange={(e) => setEditingPost((p) => ({ ...p, description: e.target.value }))}
              style={inputStyle}
              placeholder="Short excerpt shown on blog index"
            />
          </div>
          <div>
            <label style={labelStyle}>Author</label>
            <input
              value={editingPost.author ?? "Studyroom"}
              onChange={(e) => setEditingPost((p) => ({ ...p, author: e.target.value }))}
              style={inputStyle}
              placeholder="Studyroom"
            />
          </div>
          <div>
            <label style={labelStyle}>Tags (comma-separated)</label>
            <input
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              style={inputStyle}
              placeholder="study skills, confidence, anxiety"
            />
          </div>
          <div>
            <label style={labelStyle}>Date</label>
            <input
              type="date"
              value={editingPost.date ?? ""}
              onChange={(e) => setEditingPost((p) => ({ ...p, date: e.target.value }))}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Published toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#456071" }}>
            <input
              type="checkbox"
              checked={editingPost.published ?? false}
              onChange={(e) => setEditingPost((p) => ({ ...p, published: e.target.checked }))}
              style={{ width: 16, height: 16, cursor: "pointer" }}
            />
            Published (visible on public blog)
          </label>
        </div>

        {/* Side-by-side markdown + preview */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, height: 500, marginBottom: 20 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={sectionLabelStyle}>Markdown</div>
            <textarea
              value={editingPost.content ?? ""}
              onChange={(e) => setEditingPost((p) => ({ ...p, content: e.target.value }))}
              style={{
                flex: 1, border: "1.5px solid rgba(0,0,0,0.09)", borderRadius: 10,
                padding: "12px", fontSize: 13, fontFamily: "monospace",
                color: "#1d2428", outline: "none", resize: "none",
                background: "#fafbfc", lineHeight: 1.7,
              }}
              placeholder="Write your post in Markdown..."
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={sectionLabelStyle}>Preview</div>
            <div
              className="prose prose-sm max-w-none"
              style={{
                flex: 1, border: "1.5px solid rgba(0,0,0,0.06)", borderRadius: 10,
                padding: "12px 16px", background: "#fff", overflowY: "auto",
              }}
              dangerouslySetInnerHTML={{ __html: renderedPreview }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={savePost}
            disabled={saving}
            style={{
              background: saving ? "#a8bfc9" : "#456071", color: "white",
              border: "none", borderRadius: 12, padding: "10px 24px",
              fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {saving ? "Saving…" : "Save post"}
          </button>
          <button
            type="button"
            onClick={() => setEditingPost(null)}
            style={{ background: "white", color: "#456071", border: "1.5px solid #b8cad6", borderRadius: 12, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#82977e", marginBottom: 4 }}>
            Admin · Blog
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1a1f24", margin: 0, letterSpacing: "-0.02em" }}>
            Blog Posts
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4, marginBottom: 0 }}>
            {posts.length} post{posts.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <button
          type="button"
          onClick={openNewPost}
          style={{ background: "#456071", color: "white", border: "none", borderRadius: 12, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
        >
          + New post
        </button>
      </div>

      {posts.length === 0 ? (
        <div style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12, padding: "20px 16px", fontSize: 13, color: "#8a96a3", textAlign: "center" }}>
          No posts yet. Create your first post above.
        </div>
      ) : (
        <div>
          {posts.map((post) => (
            <div key={post.slug} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 16px", borderRadius: 12,
              background: "#fff", border: "1px solid rgba(0,0,0,0.06)", marginBottom: 8,
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428" }}>{post.title}</div>
                <div style={{ fontSize: 11, color: "#8a96a3", marginTop: 2 }}>
                  {new Date(post.date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                  {post.author ? ` · ${post.author}` : ""}
                  {post.tags?.length ? ` · ${post.tags.join(", ")}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
                  background: post.published ? "#d4edcc" : "#f4f7f9",
                  color: post.published ? "#2d5a24" : "#748398",
                }}>
                  {post.published ? "Published" : "Draft"}
                </span>
                <button
                  type="button"
                  onClick={() => openEditor(post)}
                  style={{ background: "#edf2f6", color: "#456071", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deletePost(post.slug)}
                  style={{ background: "#fce8ee", color: "#c0445e", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  fontWeight: 700,
  color: "#748398",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1.5px solid rgba(0,0,0,0.09)",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 13,
  color: "#1d2428",
  outline: "none",
  background: "#fafbfc",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "#748398",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  marginBottom: 6,
};
