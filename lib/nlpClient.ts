export async function analyzeWithML(text: string) {
  const res = await fetch(`${process.env.NLP_SERVICE_URL || "http://127.0.0.1:8000"}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    throw new Error("NLP service failed");
  }

  return res.json();
}
