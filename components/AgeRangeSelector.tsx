import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GlassTheme } from "../constants/LiquidGlass";

const GOLD = "#D4AF37";
const AGE_RANGES = ["18-24", "25-34", "35-44", "45+"] as const;

interface AgeRangeSelectorProps {
  value: string | null;
  onChange: (range: string) => void;
}

export default function AgeRangeSelector({
  value,
  onChange,
}: AgeRangeSelectorProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Yaş Aralığını Seç</Text>
      <View style={styles.row}>
        {AGE_RANGES.map((range) => {
          const selected = value === range;
          return (
            <TouchableOpacity
              key={range}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => onChange(range)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {range}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: GlassTheme.textMuted,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  chip: {
    flex: 1,
    height: 44,
    borderRadius: GlassTheme.radiusSm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#1E1E1E",
    alignItems: "center",
    justifyContent: "center",
  },
  chipSelected: {
    borderColor: GOLD,
    backgroundColor: "rgba(212, 175, 55, 0.12)",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: GlassTheme.textMuted,
  },
  chipTextSelected: {
    color: GlassTheme.textMain,
  },
});
