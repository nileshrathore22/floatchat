export async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch(`http://127.0.0.1:8000/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) throw new Error("Embedding service failed");

  const data = await res.json();
  return data.embedding ?? [];
}
