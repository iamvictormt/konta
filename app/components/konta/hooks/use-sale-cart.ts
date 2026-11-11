import { useMemo, useState } from "react";
import type { Product } from "../../../lib/model";
import type { CartLine, SaleCartLine } from "../types";

export function useSaleCart(products: Product[], notify: (message: string) => void) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [amountReceived, setAmountReceived] = useState("");

  const cartLines = useMemo(() => cart
    .map((line) => {
      const product = products.find((item) => item.id === line.productId);
      return product ? { product, quantity: line.quantity } : null;
    })
    .filter((line): line is SaleCartLine => line !== null), [cart, products]);
  const cartTotal = useMemo(() => cartLines.reduce((total, line) => total + line.product.price * line.quantity, 0), [cartLines]);
  const receivedAmountValue = Number(amountReceived) || 0;
  const changeAmount = Math.max(0, receivedAmountValue - cartTotal);

  function addToCart(productId: string) {
    const product = products.find((item) => item.id === productId);
    if (!product || product.stock < 1) return;
    const line = cart.find((item) => item.productId === productId);
    if (line && line.quantity >= product.stock) {
      notify("A quantidade excede o stock deste dispositivo.");
      return;
    }
    setCart(line
      ? cart.map((item) => item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item)
      : [...cart, { productId, quantity: 1 }]);
  }

  function changeQuantity(productId: string, delta: number) {
    const product = products.find((item) => item.id === productId);
    const line = cart.find((item) => item.productId === productId);
    if (delta > 0 && product && line && line.quantity >= product.stock) {
      notify("A quantidade excede o stock deste dispositivo.");
      return;
    }
    setCart((current) => current
      .map((item) => item.productId === productId ? { ...item, quantity: item.quantity + delta } : item)
      .filter((item) => item.quantity > 0));
  }

  function clearCart() {
    setCart([]);
    setAmountReceived("");
  }

  return {
    cart,
    cartLines,
    cartTotal,
    amountReceived,
    receivedAmountValue,
    changeAmount,
    setAmountReceived,
    addToCart,
    changeQuantity,
    clearCart,
  };
}
