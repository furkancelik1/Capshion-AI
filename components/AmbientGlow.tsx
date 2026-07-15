import { Dimensions } from "react-native";
import Svg, { Circle } from "react-native-svg";

const { width, height } = Dimensions.get("window");

export default function AmbientGlow() {
  return (
    <Svg
      width={width}
      height={height}
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      {/* Purple glow — top-left */}
      <Circle
        cx={width * 0.1}
        cy={height * 0.18}
        r={120}
        fill="#7A53FF"
        opacity={0.18}
      />
      <Circle
        cx={width * 0.1}
        cy={height * 0.18}
        r={80}
        fill="#7A53FF"
        opacity={0.2}
      />
      <Circle
        cx={width * 0.1}
        cy={height * 0.18}
        r={40}
        fill="#7A53FF"
        opacity={0.35}
      />
      {/* Blue glow — bottom-right */}
      <Circle
        cx={width * 0.9}
        cy={height * 0.75}
        r={140}
        fill="#2798FF"
        opacity={0.15}
      />
      <Circle
        cx={width * 0.9}
        cy={height * 0.75}
        r={90}
        fill="#2798FF"
        opacity={0.18}
      />
      <Circle
        cx={width * 0.9}
        cy={height * 0.75}
        r={50}
        fill="#2798FF"
        opacity={0.3}
      />
      {/* Secondary purple — top-right subtle */}
      <Circle
        cx={width * 0.85}
        cy={height * 0.08}
        r={100}
        fill="#7A53FF"
        opacity={0.08}
      />
    </Svg>
  );
}
