import React, { createContext, useContext, useState, ReactNode } from "react";
import { NFTDrop, SelectedPrice } from "@/types/drop";

export interface CartItem extends NFTDrop {
  quantity: number;
  selectedPrice: SelectedPrice; // The chosen payment token/price
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: NFTDrop, selectedPrice: SelectedPrice) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  totalItems: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const addToCart = (item: NFTDrop, selectedPrice: SelectedPrice) => {
    setItems((prev) => {
      // Create unique key combining drop ID and selected currency
      const cartKey = `${item.id}-${selectedPrice.currency}`;
      const existing = prev.find((i) => `${i.id}-${i.selectedPrice.currency}` === cartKey);
      if (existing) {
        return prev.map((i) =>
          `${i.id}-${i.selectedPrice.currency}` === cartKey
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { ...item, quantity: 1, selectedPrice }];
    });
    setIsOpen(true);
  };

  const removeFromCart = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const clearCart = () => {
    setItems([]);
  };

  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        clearCart,
        totalItems,
        isOpen,
        setIsOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
