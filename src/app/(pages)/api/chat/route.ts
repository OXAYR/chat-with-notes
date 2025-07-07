/** @format */

// pages/api/chat.ts

import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { ChatOpenAI } from "@langchain/openai";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic"; // (optional, for file uploads)

export async function POST(request: Request) {
  // Parse JSON body
  const body = await request.json();
  const question = body.question;

  // 1. Load the latest uploaded file (for demo, take first one)
  const files = fs.readdirSync("./tmp");
  if (!files.length) {
    return new Response(JSON.stringify({ error: "No uploaded files found." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const filePath = path.join("./tmp", files[0]);
  const loader = new PDFLoader(filePath);
  const docs = await loader.load();

  // 2. Embed and store in Chroma
  const embeddings = new OpenAIEmbeddings();
  const vectorStore = await Chroma.fromDocuments(docs, embeddings, {
    collectionName: "doc-store",
  });

  // 3. Retrieve relevant chunks
  const relevantDocs = await vectorStore.similaritySearch(question, 3);
  const context = relevantDocs.map((doc) => doc.pageContent).join("\n");

  // 4. Send to OpenAI with context
  const model = new ChatOpenAI({ temperature: 0 });
  const result = await model.call([
    { role: "system", content: "You are a helpful assistant." },
    {
      role: "user",
      content: `Answer the question using the following context:\n${context}\n\nQ: ${question}`,
    },
  ]);

  return new Response(JSON.stringify({ answer: result.content }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
