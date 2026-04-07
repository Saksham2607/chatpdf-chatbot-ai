import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

export const runtime = 'nodejs';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const anthropic = new Anthropic();

async function getEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel(
  { model: 'models/text-embedding-004' },
  { apiVersion: 'v1beta' }
);
  const result = await model.embedContent(text);
  return result.embedding.values;
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}

export async function POST(req: NextRequest) {
  try {
    const { message, userId } = await req.json();

    if (!message || !userId) {
      return NextResponse.json({ error: 'Missing message or userId' }, { status: 400 });
    }

    // 1. Embed the user's question
    const questionEmbedding = await getEmbedding(message);

    // 2. Fetch all chunks for this user from Firestore
    const chunksRef = collection(db, 'chunks');
    const chunksSnap = await getDocs(query(chunksRef, where('userId', '==', userId)));

    if (chunksSnap.empty) {
      return NextResponse.json({ error: 'No PDF found. Please upload one first.' }, { status: 404 });
    }

    // 3. Score each chunk by cosine similarity
    const scored = chunksSnap.docs.map((doc) => {
      const data = doc.data();
      const similarity = cosineSimilarity(questionEmbedding, data.embedding);
      return { text: data.text as string, similarity };
    });

    // 4. Take top 5 most relevant chunks
    const topChunks = scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)
      .map((c) => c.text);

    const context = topChunks.join('\n\n---\n\n');

    // 5. Call Claude with context + question
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: `You are a helpful assistant that answers questions about a PDF document.
Use ONLY the context provided below to answer. If the answer isn't in the context, say so honestly.

CONTEXT:
${context}`,
      messages: [{ role: 'user', content: message }],
    });

    const reply = response.content[0].type === 'text' ? response.content[0].text : '';

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}