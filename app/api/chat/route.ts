export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { convertToModelMessages, streamText, UIMessage } from 'ai';
import { anthropic as anthropicProvider } from '@ai-sdk/anthropic';

export const runtime = 'nodejs';
export const maxDuration = 60;

const getEmbedding = async (text: string) => {
  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      input: text,
      model: "voyage-2",
    }),
  });

  const data = await response.json();
  return data.data[0].embedding;
};

// Cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // AI SDK useChat sends { messages, userId }
    const messages: UIMessage[] = body.messages ?? [];
    const userId: string = body.userId ?? '';

    if (!userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }

    // Get the latest user message text
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMessage) {
      return Response.json({ error: 'No user message found' }, { status: 400 });
    }

    const userText = lastUserMessage.parts
      .filter((p) => p.type === 'text')
      .map((p) => (p as { type: 'text'; text: string }).text)
      .join(' ');

    // 1. Embed the user query
    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${process.env.VOYAGE_API_KEY}`,
  },
  body: JSON.stringify({
    input: userText,
    model: "voyage-3",
    input_type: "query",
  }),
});

const data = await response.json();
const queryEmbedResult = data.data[0].embedding;
    const queryEmbedding = queryEmbedResult.data?.[0]?.embedding as number[];

    if (!queryEmbedding) {
      return Response.json({ error: 'Failed to embed query' }, { status: 500 });
    }

    // 2. Fetch all chunks for this user from Firestore
    const chunksRef = collection(db, 'chunks');
    const snap = await getDocs(query(chunksRef, where('userId', '==', userId)));

    if (snap.empty) {
      // No PDF uploaded yet — answer without context
      const result = streamText({
        model: anthropicProvider('claude-sonnet-4-5'),
        system: 'You are a helpful AI assistant. The user has not uploaded a PDF yet. Politely inform them to upload a PDF before asking document questions, but answer general questions normally.',
        messages: await convertToModelMessages(messages),
      });
      return result.toUIMessageStreamResponse();
    }

    // 3. Score all chunks with cosine similarity
    const scored = snap.docs.map((doc) => {
      const data = doc.data();
      const sim = cosineSimilarity(queryEmbedding, data.embedding as number[]);
      return { text: data.text as string, sim };
    });

    // 4. Sort and take top 5
    scored.sort((a, b) => b.sim - a.sim);
    const topChunks = scored.slice(0, 5);
    const context = topChunks.map((c, i) => `[Chunk ${i + 1}]\n${c.text}`).join('\n\n---\n\n');

    // 5. Build system prompt with retrieved context
    const systemPrompt = `You are ChatPDF AI, an expert document analysis assistant.
Answer the user's question based ONLY on the provided document context below.
If the answer is not found in the context, say so clearly. Be concise and precise.

DOCUMENT CONTEXT:
${context}`;

    // 6. Stream the response back using AI SDK
    const result = streamText({
      model: anthropicProvider('claude-sonnet-4-5'),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    console.error('[chat] error:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
