"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Bookmark = {
  id: number;
  title: string;
  url: string;
};

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [view, setView] = useState<"add" | "list">("add"); // New state to toggle views
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);

  // ---------------- AUTH ----------------
  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  // ---------------- FETCH ----------------
  const fetchBookmarks = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("bookmarks")
      .select("id, title, url")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) setBookmarks(data);
  };

  useEffect(() => {
    if (user) fetchBookmarks();
  }, [user]);

  // ---------------- REALTIME ----------------
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("bookmark-sync")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookmarks",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchBookmarks()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // ---------------- ADD / UPDATE ----------------
  const handleSave = async () => {
    setError("");

    if (!title || !url) {
      setError("Please fill all fields");
      return;
    }

    if (editingBookmark) {
      // Update existing bookmark
      const { error } = await supabase
        .from("bookmarks")
        .update({ title, url })
        .eq("id", editingBookmark.id);

      if (error) {
        setError("Failed to update bookmark");
        return;
      }

      setBookmarks((prev) =>
        prev.map((b) =>
          b.id === editingBookmark.id ? { ...b, title, url } : b
        )
      );
      setEditingBookmark(null);
    } else {
      // Add new bookmark
      const { data, error } = await supabase
        .from("bookmarks")
        .insert({
          title,
          url,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) {
        setError("Failed to save bookmark");
        return;
      }

      setBookmarks((prev) => [data, ...prev]);
    }

    setTitle("");
    setUrl("");
    setView("list"); // Automatically switch to list view after add/update
  };

  // ---------------- DELETE ----------------
  const deleteBookmark = async (id: number) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id));

    const { error } = await supabase.from("bookmarks").delete().eq("id", id);
    if (error) {
      alert("Delete failed");
      fetchBookmarks();
    }
  };

  // ---------------- EDIT ----------------
  const editBookmark = (bookmark: Bookmark) => {
    setEditingBookmark(bookmark);
    setTitle(bookmark.title);
    setUrl(bookmark.url);
    setView("add"); // Switch to add view but pre-filled for editing
  };

  // ---------------- LOGIN ----------------
  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#fbc2eb] via-[#a6c1ee] to-[#d4fc79] flex items-center justify-center">
        <div className="bg-white text-gray-900 rounded-2xl shadow-xl p-8 w-full max-w-md">
          <h1 className="text-3xl font-bold mb-2 ">🔖 Bookmark Manager</h1>
          <p className="text-gray-500 mb-6 flex items-center justify-center">
            Save your links, synced in real time.
          </p>
          <button
            onClick={signInWithGoogle}
            className="w-full bg-red-500 text-white py-2 rounded-lg"
          >
            Sign in with Google
          </button>
        </div>
      </main>
    );
  }

  // ---------------- APP ----------------
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#fbc2eb] via-[#a6c1ee] to-[#d4fc79] flex items-center justify-center">
      <div className="bg-white text-gray-900 rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold">🔖 Bookmark Manager</h1>
          <button
            onClick={signOut}
            className="flex items-center gap-1 text-sm text-red-500 border border-red-300 px-3 py-1 rounded-md hover:bg-red-50 transition"
          >
            Logout
          </button>
        </div>

        {/* ---------------- CONDITIONAL RENDERING ---------------- */}
        {view === "add" && (
          <>
            <input
              className="w-full border rounded-lg p-2 mb-3"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              className="w-full border rounded-lg p-2 mb-3"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            {error && <p className="text-red-500 mb-2">{error}</p>}
            <button
              onClick={handleSave}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-2 rounded-lg"
            >
              {editingBookmark ? "Update Bookmark" : "Add Bookmark"}
            </button>
            <button
              onClick={() => {
                setView("list");
                setEditingBookmark(null);
                setTitle("");
                setUrl("");
              }}
              className="w-full mt-2 border border-gray-300 py-2 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              View Bookmarks
            </button>
          </>
        )}

        {view === "list" && (
          <>
            <ul className="mt-6 space-y-3">
              {bookmarks.map((b) => (
                <li
                  key={b.id}
                  className="bg-gray-50 rounded-lg p-3 flex justify-between items-center"
                >
                  <div>
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${b.url}`}
                      className="inline w-4 h-4 mr-2"
                    />
                    <strong>{b.title}</strong>
                    <br />
                    <a
                      href={b.url}
                      target="_blank"
                      className="text-blue-600 text-sm"
                    >
                      {b.url}
                    </a>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => editBookmark(b)}
                      className="text-purple-500 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteBookmark(b.id)}
                      className="text-red-500 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {bookmarks.length === 0 && (
              <p className="text-center text-gray-500 mt-4">
                No bookmarks yet 🚀
              </p>
            )}
            <button
              onClick={() => {
                setView("add");
                setEditingBookmark(null);
                setTitle("");
                setUrl("");
              }}
              className="w-full mt-4 border border-gray-300 py-2 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Add New Bookmark
            </button>
          </>
        )}
      </div>
    </main>
  );
}
