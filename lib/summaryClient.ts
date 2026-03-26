export async function summarizeMessages(texts: string[]) {
  const res = await fetch("http://127.0.0.1:8000/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts }),
  });

  if (!res.ok) throw new Error("Summary service failed");
  return res.json();
}
