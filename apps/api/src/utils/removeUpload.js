import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

export async function removeUpload(url) {
  if (
    typeof url !== "string" ||
    !/^\/uploads\/(avatars\/)?[\w-]+\.(png|jpg|webp)$/.test(url)
  )
    return;
  const path = fileURLToPath(
    new URL(`../uploads/${url.slice("/uploads/".length)}`, import.meta.url),
  );
  try {
    await fs.unlink(path);
  } catch (error) {
    if (error.code !== "ENOENT")
      console.warn("Unable to remove uploaded media:", error.code);
  }
}
