import { View, Text, StyleSheet } from "react-native";

export default function GasLevelCard({ percentage, weight }) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Gas Level</Text>
      <Text style={styles.value}>{percentage}%</Text>
      <Text>Weight: {weight} kg</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: "#e0f2fe",
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
  },
  value: {
    fontSize: 36,
    fontWeight: "bold",
  },
});
