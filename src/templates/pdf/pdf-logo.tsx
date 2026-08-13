import React from "react";
import { Image, StyleSheet, View } from "@react-pdf/renderer";

const LOGO_ASPECT = 520 / 97; // trimmed PNG width / height

const variantStyles = StyleSheet.create({
  voucher: {
    wrap: { width: 150, marginBottom: 2, alignSelf: "flex-start" as const },
    image: { width: 150, height: 28, objectFit: "contain" as const, objectPosition: "left" as const },
  },
  invoice: {
    wrap: { width: 92, marginBottom: 4, alignSelf: "flex-start" as const },
    image: { width: 92, height: 17, objectFit: "contain" as const, objectPosition: "left" as const },
  },
  squareVoucher: {
    wrap: { width: 56, height: 56, marginBottom: 4, alignSelf: "flex-start" as const },
    image: { width: 56, height: 56, objectFit: "cover" as const },
  },
  squareInvoice: {
    wrap: { width: 48, height: 48, marginBottom: 4, alignSelf: "flex-start" as const },
    image: { width: 48, height: 48, objectFit: "cover" as const },
  },
});

export function PdfLogo({
  src,
  variant = "voucher",
  square = false,
}: Readonly<{ src?: string | null; variant?: "voucher" | "invoice"; square?: boolean }>) {
  if (!src) return null;
  const key = square ? (variant === "invoice" ? "squareInvoice" : "squareVoucher") : variant;
  const s = variantStyles[key];
  return (
    <View style={s.wrap}>
      <Image src={src} style={s.image} />
    </View>
  );
}

// exported for layout math if needed elsewhere
export function invoiceLogoHeight(width = 92) {
  return Math.round((width / LOGO_ASPECT) * 10) / 10;
}
