/** @format */

// app/api/chat/route.ts (App Router, Next.js 14+)

import { NextRequest, NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

interface RequestBody {
  question: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;
    const question = body.question;

    if (
      !question ||
      typeof question !== "string" ||
      question.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Valid question is required." },
        { status: 400 }
      );
    }

    // Check for OpenAI API key
    if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key is required." },
        { status: 500 }
      );
    }

    const tmpDir = path.join(process.cwd(), "tmp");
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir);
    }

    const files = fs.readdirSync(tmpDir);
    const pdfFiles = files.filter((file) => file.endsWith(".pdf"));

    if (!pdfFiles.length) {
      return NextResponse.json(
        { error: "No PDF files found." },
        { status: 400 }
      );
    }

    console.log("Loading PDF:", pdfFiles[0]);
    const filePath = path.join(tmpDir, pdfFiles[0]);
    const loader = new PDFLoader(filePath);
    const docs = await loader.load();

    if (!docs || docs.length === 0) {
      return NextResponse.json(
        { error: "Failed to load PDF content." },
        { status: 500 }
      );
    }

    console.log(`Loaded ${docs.length} documents`);

    // Split documents into smaller chunks for better retrieval
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const splitDocs = await textSplitter.splitDocuments(docs);
    console.log(`Split into ${splitDocs.length} chunks`);

    // Initialize embeddings
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
    });

    // Create vector store
    console.log("Creating vector store...");
    const vectorStore = await Chroma.fromDocuments(splitDocs, embeddings, {
      collectionName: `doc-store-${Date.now()}`,
    });

    // Perform similarity search
    console.log("Searching for relevant documents...");
    const relevantDocs = await vectorStore.similaritySearch(question, 5);

    if (!relevantDocs || relevantDocs.length === 0) {
      return NextResponse.json(
        { error: "No relevant documents found." },
        { status: 404 }
      );
    }

    console.log(`Found ${relevantDocs.length} relevant documents`);
    const context = relevantDocs.map((doc) => doc.pageContent).join("\n\n");

    // Initialize ChatOpenAI
    const model = new ChatOpenAI({
      model: "gpt-4.1",
      temperature: 0.7,
      openAIApiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
    });

    const prompt = `You are a helpful assistant. Answer the following question using ONLY the context provided. If the answer is not in the context, say you don't know.

Context:
${context}

Question: ${question}

Answer:`;

    console.log("Generating response...");
    const result = await model.invoke(prompt);

    // Clean up the PDF file
    try {
      fs.unlinkSync(filePath);
      console.log("PDF file cleaned up");
    } catch (e) {
      console.warn("File cleanup failed:", e);
    }

    return NextResponse.json(
      {
        answer: result.content,
        sources: relevantDocs.length,
        model: "gpt-4.1",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json(
      {
        error: error.message || "Internal server error.",
        details: error.name || "Unknown error",
      },
      { status: 500 }
    );
  }
}
