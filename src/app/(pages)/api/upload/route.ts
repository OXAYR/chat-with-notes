/** @format */

// pages/api/upload.ts

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

  // Example: Read file contents (for .txt), or save to disk, etc.
  // For now, just return a success message
  return new Response(JSON.stringify({ message: "Uploaded successfully" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
