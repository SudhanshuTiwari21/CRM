import { Image, StyleSheet, View } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  // Deliberately larger for voucher/invoice readability in printed PDFs.
  // Keep natural aspect ratio from source PNG (~520x97) to avoid distortion.
  logoWrap: { width: 150, minHeight: 28, justifyContent: "center" },
  logo: { width: 150, height: 28, objectFit: "contain", objectPosition: "left" },
});

export function PdfLogo({ src }: Readonly<{ src?: string | null }>) {
  if (!src) return null;
  return (
    <View style={styles.logoWrap}>
      <Image src={src} style={styles.logo} />
    </View>
  );
}
