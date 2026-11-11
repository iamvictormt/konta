import "server-only";
import { createHash } from "node:crypto";

export function cloudinaryConfig() {
  const value = process.env.CLOUDINARY_URL;
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol !== "cloudinary:" || !url.username || !url.password || !/^[a-z0-9-]+$/.test(url.hostname)) return null;
  return { cloud: url.hostname, key: decodeURIComponent(url.username), secret: decodeURIComponent(url.password) };
}

export function productImageId(organizationId: string, productId: string) {
  const tenant = createHash("sha256").update(organizationId).digest("hex");
  return `konta/products/${tenant}/${productId}`;
}

export function productImageUrl(cloud: string, publicId: string) {
  return `https://res.cloudinary.com/${cloud}/image/upload/c_fill,w_160,h_160,q_auto,f_auto/${publicId}.jpg`;
}
