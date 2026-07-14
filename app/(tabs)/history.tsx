import { StyleSheet, Text, useColorScheme, View } from "react-native";
import Colors from "../../constants/Colors";
export default function HistoryScreen() {
  const colorScheme = useColorScheme() || "dark";

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: Colors[colorScheme as "light" | "dark"].background },
      ]}
    >
      <Text style={[styles.title, { color: Colors[colorScheme as "light" | "dark"].text }]}>
        Geçmiş
      </Text>
      <Text style={{ color: Colors[colorScheme as "light" | "dark"].icon }}>
        Daha önce ürettiğin açıklamalar burada listelenecek.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 10 },
});
