"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth, storage } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { 
  Plus, 
  LogOut, 
  Search, 
  MessageSquare, 
  User, 
  Bot, 
  Send, 
  Sparkles,
  MoreVertical,
  Settings,
  Paperclip,
  X,
  Menu,
  Copy,
  Check,
  RefreshCw,
  ThumbsUp,
  ThumbsDown
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/atom-one-dark.css";

/* ================= TYPES ================= */

type Session = {
  id: string;
  title: string | null;
  summary?: string | null;
  createdAt: string;
};

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sentiment?: string | null;
  intent?: string | null;
  keywords?: string | null;
  smartReplies?: string[] | null;
  imageUrl?: string | null;
};

/* ================= HELPERS ================= */

function isSameSender(prev?: Msg, curr?: Msg) {
  return prev && curr && prev.role === curr.role;
}

function sentimentColor(sentiment?: string | null) {
  if (!sentiment) return "text-slate-400";
  const s = sentiment.toLowerCase();
  if (s.includes("neg")) return "text-red-400";
  if (s.includes("pos")) return "text-green-400";
  return "text-yellow-400";
}

async function authedFetch(url: string, init: RequestInit = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const token = await user.getIdToken();

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (!headers.get("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, { ...init, headers });
}

/* ================= PAGE ================= */

export default function AppPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<any>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      setIsSidebarOpen(true);
    }
  }, []);

  const uploadImage = async (f: File) => {
    if (!user) return null;
    const ext = f.name.split('.').pop();
    const path = `chat_images/${user.uid}/${Date.now()}_img.${ext}`;
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, f);
    return getDownloadURL(snapshot.ref);
  };

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  /* ---------- AUTH ---------- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.replace("/login");
        return;
      }
      setUser(u);
      
      // 🔹 Ensure user exists in local DB
      try {
        await authedFetch("/api/user/sync", { method: "POST" });
      } catch (e) {
        console.error("Sync error:", e);
      }
      
      setReady(true);
    });
    return () => unsub();
  }, [router]);

  const activeSession = useMemo(
    () => Array.isArray(sessions)
      ? sessions.find((s) => s.id === activeSessionId) ?? null
      : null,
    [sessions, activeSessionId]
  );

  /* ---------- LOAD DATA ---------- */
  useEffect(() => {
    if (!ready) return;
    authedFetch("/api/sessions")
      .then((r) => r.json())
      .then((d) => {
        setSessions(d.sessions || []);
        if (!activeSessionId && d.sessions?.length) {
          setActiveSessionId(d.sessions[0].id);
        }
      });
  }, [ready]);

  useEffect(() => {
    if (!activeSessionId) return;
    authedFetch(`/api/sessions/${activeSessionId}/messages`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.messages)) {
          setMessages(d.messages);
        } else {
          setMessages([]);
        }
      });
  }, [activeSessionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  /* ---------- ACTIONS ---------- */
  const newChat = async () => {
    setBusy(true);
    try {
      const res = await authedFetch("/api/sessions", { method: "POST" });
      const data = await res.json();
      if (data.ok && data.session) {
        setSessions(p => [data.session, ...p]);
        setActiveSessionId(data.session.id);
        setIsSidebarOpen(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const content = text.trim();
    if (!content && !file) return;

    let targetSessionId = activeSessionId;

    // 🔹 Auto-create session if none active
    if (!targetSessionId) {
      setBusy(true);
      try {
        let res = await authedFetch("/api/sessions", { method: "POST" });
        let data = await res.json();
        
        // If user not found, try one sync and retry
        if (!data.ok && data.error === "User not found") {
          console.log("User not found in DB, syncing...");
          await authedFetch("/api/user/sync", { method: "POST" });
          res = await authedFetch("/api/sessions", { method: "POST" });
          data = await res.json();
        }

        if (data.ok && data.session) {
          setSessions(p => [data.session, ...p]);
          setActiveSessionId(data.session.id);
          targetSessionId = data.session.id;
        } else {
          console.error("Failed to create session:", data.error);
          setBusy(false);
          alert(`Error: ${data.error}. Please try again.`);
          return;
        }
      } catch (e) {
        console.error("Session creation error:", e);
        setBusy(false);
        return;
      }
    }

    setBusy(true);

    let uploadedUrl: string | null = null;
    if (file) {
      try {
        uploadedUrl = await uploadImage(file);
      } catch (e) {
        console.error("Upload error:", e);
        setBusy(false);
        return;
      }
    }

    setText("");
    setFile(null);
    setFilePreview(null);

    const tempId = `temp-${Date.now()}`;
    const assistantTempId = `assistant-${Date.now()}`;
    
    setMessages((p) => [
      ...p,
      {
        id: tempId,
        role: "user",
        content,
        imageUrl: uploadedUrl,
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const res = await authedFetch(`/api/sessions/${targetSessionId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content, imageUrl: uploadedUrl }),
      });

      if (!res.ok) throw new Error("Failed to send message");

      // 🔹 Handle Streaming
      if (!res.body) throw new Error("No response body");
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullAssistantContent = "";

      const smartRepliesHeader = res.headers.get("X-Smart-Replies");
      let smartReplies: string[] = [];
      try {
        if (smartRepliesHeader) smartReplies = JSON.parse(smartRepliesHeader);
      } catch (e) {
        console.error("Error parsing smart replies header:", e);
      }

      // Add placeholder assistant message
      setMessages((p) => [
        ...p,
        {
          id: assistantTempId,
          role: "assistant",
          content: "",
          smartReplies,
          createdAt: new Date().toISOString(),
        },
      ]);

      setBusy(false); // Stop "thinking" indicator as we are now streaming

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        fullAssistantContent += chunk;
        
        setMessages((p) => p.map(m => 
          m.id === assistantTempId ? { ...m, content: fullAssistantContent } : m
        ));
      }

      // 🔹 Final sync with DB to get IDs/Metadata/Smart Replies
      // Wait 1.5s to ensure the background Prisma save is fully completed
      setTimeout(async () => {
        try {
          const syncRes = await authedFetch(`/api/sessions/${targetSessionId}/messages`);
          const syncData = await syncRes.json();
          if (syncData.ok && Array.isArray(syncData.messages)) {
            setMessages(prev => {
              // Only update if we haven't switched to a different chat
              if (!prev.some(m => m.id === assistantTempId)) return prev;
              return syncData.messages;
            });
          }
        } catch (e) {
          console.error("Delayed sync failed", e);
        }
      }, 1500);

    } catch (e) {
      console.error("Send error:", e);
      setMessages((p) => p.filter((m) => m.id !== tempId && m.id !== assistantTempId));
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#020617]">
      <div className="flex flex-col items-center gap-4">
        <Sparkles className="w-10 h-10 text-blue-500 animate-pulse" />
        <div className="text-slate-400 text-sm font-medium">Loading FloatChat...</div>
      </div>
    </div>
  );

  return (
    <div className="h-[100dvh] flex bg-[#020617] text-slate-200 overflow-hidden w-full relative">
      {/* MOBILE OVERLAY */}
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}

      {/* DESKTOP PUSH WRAPPER */}
      <div className={`hidden md:block transition-all duration-300 ease-in-out shrink-0 ${isSidebarOpen ? "w-[280px] sm:w-80" : "w-0"}`} />

      {/* SIDEBAR */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-[280px] sm:w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 shadow-2xl 
        transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/10">
              <Sparkles className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white">FloatChat</span>
          </div>
        </div>

        <div className="px-4 mb-4">
          <Button 
            className="w-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700/50 shadow-sm transition-all h-10 rounded-xl flex items-center gap-2"
            onClick={newChat} 
            disabled={busy}
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">New Conversation</span>
          </Button>
        </div>

        <div className="px-4 mb-4">
          <div className="relative group">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
            <input
              value={search}
              onChange={async (e) => {
                const q = e.target.value;
                setSearch(q);
                if (!q) {
                  setSearchResults([]);
                  return;
                }
                const res = await authedFetch("/api/search", {
                  method: "POST",
                  body: JSON.stringify({ query: q }),
                });
                const data = await res.json();
                setSearchResults(data.results || []);
              }}
              placeholder="Search history..."
              className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-600"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 custom-scrollbar">
          <div className="space-y-1 mb-4">
            {searchResults.length > 0 ? (
              searchResults.map((r) => (
                <button
                  key={r.id}
                  onClick={() => { setActiveSessionId(r.sessionId); setIsSidebarOpen(false); }}
                  className="w-full text-left px-3 py-3 rounded-xl hover:bg-slate-800/50 transition-all border border-transparent hover:border-slate-700/30 group"
                >
                  <div className="text-sm text-slate-300 truncate font-medium group-hover:text-white">{r.content}</div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    {(r.score * 100).toFixed(0)}% relevant
                  </div>
                </button>
              ))
            ) : (
              sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setActiveSessionId(s.id); setIsSidebarOpen(false); }}
                  className={`w-full text-left px-3 py-3 rounded-xl transition-all border ${
                    s.id === activeSessionId 
                      ? "bg-blue-600/10 border-blue-500/30 text-white" 
                      : "hover:bg-slate-800/50 border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className={`w-4 h-4 ${s.id === activeSessionId ? "text-blue-400" : "text-slate-500"}`} />
                    <div className="flex-1 overflow-hidden">
                      <div className="text-sm font-medium truncate">{s.title ?? "New Conversation"}</div>
                      <div className="text-[10px] opacity-50 mt-0.5">{new Date(s.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 p-2 rounded-2xl bg-slate-950/30 border border-slate-800/50">
            <Avatar className="h-9 w-9 border border-slate-700">
              <AvatarImage src={user?.photoURL} />
              <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-[10px] text-white">
                {user?.email?.[0].toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <div className="text-xs font-semibold text-white truncate">{user?.email}</div>
              <div className="text-[10px] text-slate-500">Free Plan</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-red-500/10 hover:text-red-400 transition-colors"
              onClick={async () => {
                await signOut(auth);
              }}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className="flex-1 flex flex-col relative bg-[#020617] min-w-0 min-h-0">

        <header className="h-16 shrink-0 flex items-center justify-between px-4 md:px-6 border-b border-slate-800 bg-slate-900/40 backdrop-blur-md z-10 relative">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-slate-400 hover:text-white hover:bg-slate-800 h-9 w-9 shrink-0 shadow-sm border border-slate-800/50 bg-slate-900/50"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex flex-col">
            <h2 className="text-sm font-semibold text-white tracking-tight">
              {activeSession?.title ?? "FloatChat Assistant"}
            </h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Online</span>
            </div>
          </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800 h-9 w-9">
              <Settings className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800 h-9 w-9">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
            {messages.length === 0 && !busy && (
              <div className="flex flex-col items-center justify-center py-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center mb-6">
                  <Sparkles className="w-10 h-10 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">How can I help you today?</h3>
                <p className="text-slate-500 text-sm max-w-sm text-center">
                  I'm your AI assistant, capable of understanding context, sentiment, and providing smart replies.
                </p>
              </div>
            )}

            {messages.map((m, i) => {
              const grouped = isSameSender(messages[i - 1], m);
              const isAi = m.role === "assistant";

              return (
                <div 
                  key={m.id} 
                  className={`flex gap-4 ${isAi ? "flex-row" : "flex-row-reverse"} ${grouped ? "mt-[-24px]" : "mt-0"}`}
                >
                  {!grouped && (
                    <Avatar className={`h-9 w-9 shadow-lg ${isAi ? "bg-slate-800" : "bg-blue-600"}`}>
                      {isAi ? <Bot className="w-5 h-5 text-blue-400" /> : <User className="w-5 h-5 text-white" />}
                    </Avatar>
                  )}
                  {grouped && <div className="w-9" />}

                  <div className={`flex flex-col gap-2 max-w-[80%] ${isAi ? "items-start" : "items-end"}`}>
                    {!grouped && (
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">
                        {isAi ? "Assistant" : "You"}
                      </span>
                    )}
                    <div className={`p-4 rounded-3xl text-sm leading-relaxed shadow-sm transition-all hover:shadow-md border ${
                      isAi 
                        ? "bg-slate-900 border-slate-800 text-slate-300 rounded-tl-none" 
                        : "bg-gradient-to-br from-blue-600 to-blue-700 border-blue-500 text-white rounded-tr-none"
                    }`}>
                      {m.imageUrl && (
                        <div className="mb-3">
                          <img src={m.imageUrl} alt="attachment" className="rounded-xl max-w-full max-h-[300px] object-cover border border-slate-700/50" />
                        </div>
                      )}
                      {m.content && (
                        <div className="markdown-prose text-sm max-w-full overflow-hidden">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]} 
                            rehypePlugins={[rehypeHighlight]}
                            components={{
                              p: ({node, ...props}) => <p className="mb-3 last:mb-0 leading-relaxed" {...props} />,
                              a: ({node, ...props}) => <a className="text-blue-400 hover:underline hover:text-blue-300 transition-colors" target="_blank" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-1 mb-3" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal pl-5 space-y-1 mb-3" {...props} />,
                              h1: ({node, ...props}) => <h1 className="text-xl font-bold mb-3 mt-4" {...props} />,
                              h2: ({node, ...props}) => <h2 className="text-lg font-bold mb-3 mt-4 text-white" {...props} />,
                              h3: ({node, ...props}) => <h3 className="text-base font-bold mb-2 mt-3 text-slate-200" {...props} />,
                              code({node, inline, className, children, ...props}: any) {
                                const match = /language-(\w+)/.exec(className || '');
                                return !inline && match ? (
                                  <div className="my-4 rounded-xl overflow-hidden border border-slate-700/50 bg-[#0d1117] shadow-sm max-w-full">
                                    <div className="flex items-center justify-between px-4 py-1.5 bg-slate-800/50 border-b border-slate-700/50">
                                      <span className="text-xs font-mono text-slate-400 capitalize">{match[1]}</span>
                                    </div>
                                    <pre className="p-4 overflow-x-auto text-[13px] leading-relaxed relative">
                                      <code className={className} {...props}>{children}</code>
                                    </pre>
                                  </div>
                                ) : (
                                  <code className="bg-slate-800/80 text-blue-300 px-1.5 py-0.5 rounded-md text-[13px] font-mono break-words" {...props}>
                                    {children}
                                  </code>
                                )
                              },
                              table: ({node, ...props}) => <div className="overflow-x-auto mb-4 border border-slate-700/50 rounded-xl"><table className="w-full text-left border-collapse text-sm" {...props} /></div>,
                              th: ({node, ...props}) => <th className="border-b border-slate-700/50 bg-slate-800/30 p-3 font-semibold text-slate-200" {...props} />,
                              td: ({node, ...props}) => <td className="border-b border-slate-700/30 p-3 text-slate-300" {...props} />
                            }}
                          >
                            {m.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>

                    {isAi && m.content && m.content.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1 text-slate-500">
                        <button 
                          onClick={() => handleCopy(m.id, m.content)} 
                          className="p-1.5 hover:bg-slate-800 hover:text-slate-300 rounded-lg transition-all"
                          title="Copy"
                        >
                          {copiedId === m.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button 
                          onClick={() => {
                            let lastPrompt = "";
                            for (let j = i - 1; j >= 0; j--) {
                              if (messages[j].role === "user") {
                                lastPrompt = messages[j].content;
                                break;
                              }
                            }
                            if (lastPrompt) {
                              setText(lastPrompt);
                              setTimeout(send, 100);
                            }
                          }}
                          className="p-1.5 hover:bg-slate-800 hover:text-slate-300 rounded-lg transition-all"
                          title="Retry Response"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          className="p-1.5 hover:bg-slate-800 hover:text-slate-300 rounded-lg transition-all"
                          title="Helpful"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          className="p-1.5 hover:bg-slate-800 hover:text-slate-300 rounded-lg transition-all"
                          title="Not Helpful"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {isAi && Array.isArray(m.smartReplies) && m.smartReplies.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {m.smartReplies.map((r) => (
                          <button
                            key={r}
                            onClick={() => {
                              setText(r);
                              setTimeout(send, 0);
                            }}
                            className="bg-slate-900/50 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/50 py-1.5 px-4 rounded-full text-xs text-slate-400 hover:text-blue-400 transition-all active:scale-95"
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {busy && (
              <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2">
                <Avatar className="h-9 w-9 bg-slate-800">
                  <Bot className="w-5 h-5 text-blue-400" />
                </Avatar>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl rounded-tl-none">
                  <TypingIndicator />
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </div>

        <div className="p-6">
          <div className="max-w-4xl mx-auto relative">
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-2 pr-4 shadow-2xl transition-all focus-within:border-blue-500/50 focus-within:ring-4 focus-within:ring-blue-500/5">
              {filePreview && (
                <div className="px-4 pt-2 pb-2 relative inline-block group mb-2">
                  <div className="relative border border-slate-700/50 rounded-xl overflow-hidden bg-slate-950/50 w-24 h-24 shadow-md">
                    <img src={filePreview} alt="Preview" className="w-full h-full object-cover" />
                    <button 
                      onClick={() => { setFilePreview(null); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
              <div className="flex items-end gap-2">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  hidden 
                  accept="image/*,application/pdf,text/plain,.doc,.docx,.csv" 
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setFile(f);
                      setFilePreview(URL.createObjectURL(f));
                    }
                  }} 
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10 shrink-0 text-slate-400 hover:text-white mb-1 rounded-2xl"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                >
                  <Paperclip className="w-5 h-5" />
                </Button>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-transparent border-none text-white placeholder:text-slate-600 focus-visible:ring-0 resize-none min-h-[50px] max-h-[200px] py-3 px-4"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <Button 
                  size="icon"
                  className={`h-10 w-10 rounded-2xl transition-all ${
                    text.trim() || busy 
                      ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20" 
                      : "bg-slate-800 text-slate-500"
                  }`}
                  onClick={send} 
                  disabled={busy || (!text.trim() && !file)}
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-center text-slate-600 mt-3 uppercase tracking-widest font-bold">
              Powered by FloatChat Intelligence • Standard Context v1.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
