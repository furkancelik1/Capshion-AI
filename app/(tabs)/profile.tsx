import { StyleSheet, Text, useColorScheme, View } from "react-native";
import Colors from "../../constants/Colors";
export default function ProfileScreen() {
  const colorScheme = (useColorScheme() ?? "dark") as "light" | "dark";

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: Colors[colorScheme].background },
      ]}
    >
      <Text style={[styles.title, { color: Colors[colorScheme].text }]}>
        Profil
      </Text>
      <Text style={{ color: Colors[colorScheme].icon }}>
        Hesap ayarları ve kalan kredi durumu.
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
