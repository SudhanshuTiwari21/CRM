import { Image, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  logo: { width: 140, height: 40, objectFit: "contain" },
});

export function PdfLogo({ src }: { src: string }) {
  return <Image src={src} style={styles.logo} />;
}
