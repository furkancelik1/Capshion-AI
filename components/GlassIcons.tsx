import Svg, { Path, Defs, LinearGradient, Stop, Rect, Circle } from 'react-native-svg';

const gradientId = 'iconGrad';

export function ToneIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#7A53FF" />
          <Stop offset="100%" stopColor="#2798FF" />
        </LinearGradient>
      </Defs>
      <Path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"
        fill={`url(#${gradientId})`}
      />
    </Svg>
  );
}

export function HashtagIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <LinearGradient id={`${gradientId}2`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#7A53FF" />
          <Stop offset="100%" stopColor="#2798FF" />
        </LinearGradient>
      </Defs>
      <Path
        d="M10 2L9 4H5a1 1 0 000 2h3.5l-1 4H4a1 1 0 000 2h3l-1 4H4a1 1 0 000 2h2.5l-.5 2h2l.5-2h3.5l-.5 2h2l.5-2H19a1 1 0 000-2h-3.5l1-4H20a1 1 0 000-2h-3l1-4H20a1 1 0 000-2h-2.5l.5-2h-2l-.5 2h-3.5l.5-2h-2zM13.5 16H10l1-4h3.5l-1 4z"
        fill={`url(#${gradientId}2)`}
      />
    </Svg>
  );
}

export function FeedIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <LinearGradient id={`${gradientId}3`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#7A53FF" />
          <Stop offset="100%" stopColor="#2798FF" />
        </LinearGradient>
      </Defs>
      <Path
        d="M4 4v16h16V4H4zm14 14H6V6h12v12zM8 8h8v2H8V8zm0 4h8v2H8v-2zm0 4h5v2H8v-2z"
        fill={`url(#${gradientId}3)`}
      />
    </Svg>
  );
}

export function PersonIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <LinearGradient id={`${gradientId}5`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#7A53FF" />
          <Stop offset="100%" stopColor="#2798FF" />
        </LinearGradient>
      </Defs>
      <Path
        d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
        fill={`url(#${gradientId}5)`}
      />
    </Svg>
  );
}

export function LogOutIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <LinearGradient id={`${gradientId}6`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#FF4B4B" />
          <Stop offset="100%" stopColor="#FF6B6B" />
        </LinearGradient>
      </Defs>
      <Path
        d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"
        fill={`url(#${gradientId}6)`}
      />
    </Svg>
  );
}

export function ClockIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <LinearGradient id={`${gradientId}7`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#7A53FF" />
          <Stop offset="100%" stopColor="#2798FF" />
        </LinearGradient>
      </Defs>
      <Path
        d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"
        fill={`url(#${gradientId}7)`}
      />
    </Svg>
  );
}

export function SparkleIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <LinearGradient id={`${gradientId}4`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#7A53FF" />
          <Stop offset="100%" stopColor="#2798FF" />
        </LinearGradient>
      </Defs>
      <Path
        d="M12 2l1.5 6L19 9.5l-5.5 1.5L12 17l-1.5-6L5 9.5l5.5-1.5L12 2z"
        fill={`url(#${gradientId}4)`}
      />
    </Svg>
  );
}
