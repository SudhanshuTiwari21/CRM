import { Image, StyleSheet, View } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  logoWrap: { width: 200, minHeight: 48, justifyContent: "center" },
  logo: { width: 200, height: 48, objectFit: "contain", objectPosition: "left" },
});

export function PdfLogo({ src }: { src?: string | null }) {
  if (!src) return null;
  return (
    <View style={styles.logoWrap}>
      <Image src={src} style={styles.logo} />
    </View>
  );
}
