/** @format */

// pages/api/upload.ts

import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic"; // (optional, for file uploads)

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return new Response(JSON.stringify({ error: "No file uploaded" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Ensure tmp directory exists
  const tmpDir = path.join(process.cwd(), "tmp");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir);
  }

  // Save the file to disk
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const filePath = path.join(tmpDir, file.name);
  fs.writeFileSync(filePath, buffer);

  return new Response(JSON.stringify({ message: "Uploaded successfully" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
