import PostHog from "posthog-react-native";

const projectToken = process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST;
const isConfigured = Boolean(projectToken && host);

if (!isConfigured && __DEV__) {
  const missingVariable = projectToken
    ? "EXPO_PUBLIC_POSTHOG_HOST"
    : "EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN";
  console.warn(
    `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`,
  );
}

export const posthog = new PostHog(projectToken ?? "disabled", {
  ...(host ? { host } : {}),
  disabled: !isConfigured,
  captureAppLifecycleEvents: true,
  preloadFeatureFlags: true,
});
