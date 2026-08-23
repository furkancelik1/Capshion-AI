import { Dimensions } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

const { width, height } = Dimensions.get("window");

export default function AmbientGlow() {
  return (
    <Svg
      width={width}
      height={height}
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      <Defs>
        <RadialGradient id="purpleGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#34C759" stopOpacity="0.1" />
          <Stop offset="50%" stopColor="#34C759" stopOpacity="0.04" />
          <Stop offset="100%" stopColor="#34C759" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="blueGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FF9500" stopOpacity="0.08" />
          <Stop offset="50%" stopColor="#FF9500" stopOpacity="0.03" />
          <Stop offset="100%" stopColor="#FF9500" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="neonGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#8E8E93" stopOpacity="0.05" />
          <Stop offset="60%" stopColor="#8E8E93" stopOpacity="0.02" />
          <Stop offset="100%" stopColor="#8E8E93" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* Soft green orb — top-left */}
      <Circle cx={width * 0.08} cy={height * 0.12} r={160} fill="url(#purpleGlow)" />
      <Circle cx={width * 0.08} cy={height * 0.12} r={80} fill="#34C759" opacity={0.03} />

      {/* Neutral orb — mid-right */}
      <Circle cx={width * 0.82} cy={height * 0.35} r={140} fill="url(#neonGlow)" />

      {/* Soft orange orb — bottom-center */}
      <Circle cx={width * 0.5} cy={height * 0.78} r={200} fill="url(#blueGlow)" />
      <Circle cx={width * 0.5} cy={height * 0.78} r={100} fill="#FF9500" opacity={0.02} />

      {/* Soft green orb — bottom-left */}
      <Circle cx={width * 0.15} cy={height * 0.88} r={120} fill="url(#purpleGlow)" />

      {/* Micro accent — top-right corner */}
      <Circle cx={width * 0.92} cy={height * 0.06} r={60} fill="url(#neonGlow)" />
    </Svg>
  );
}
