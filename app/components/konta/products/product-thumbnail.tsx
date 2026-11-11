import Image from "next/image";
import { useState } from "react";
import type { Product } from "../../../lib/model";

export function ProductThumbnail({ product, className = "product-emoji" }: {
  product: Product;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const url = product.imageUrl;

  return <span className={`${className} product-thumbnail`} aria-hidden="true">
    {url && failedUrl !== url
      ? <Image src={url} alt="" width={80} height={80} unoptimized onError={() => setFailedUrl(url)} />
      : product.emoji || "📦"}
  </span>;
}
