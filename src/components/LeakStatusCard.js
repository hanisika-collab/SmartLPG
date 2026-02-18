import { View, Text, StyleSheet } from "react-native";

export default function LeakStatusCard({ leak }) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: leak ? "#fee2e2" : "#dcfce7" },
      ]}
    >
      <Text style={styles.text}>
        {leak ? "⚠ GAS LEAK DETECTED" : "✔ No Gas Leak"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 15,
    borderRadius: 10,
  },
  text: {
    fontWeight: "bold",
    textAlign: "center",
  },
});
