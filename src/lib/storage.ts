import fs from "node:fs";
import path from "node:path";

// Storage mock (F2, sem Supabase Storage ainda): grava o arquivo em
// public/uploads/{companyId}/ e devolve a URL pública relativa. Quando o
// Supabase Storage entrar, isto vira upload pro bucket `photos` + URL assinada.

export async function savePhoto(
  file: File,
  companyId: string
): Promise<string> {
  const ext = extensionFromType(file.type) ?? "jpg";
  const filename = `${crypto.randomUUID()}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", companyId);
  fs.mkdirSync(dir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(dir, filename), buffer);

  return `/uploads/${companyId}/${filename}`;
}

function extensionFromType(mime: string): string | null {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}
