import { CustomerInfo } from "react-native-purchases";

export function hasPremiumEntitlement(customerInfo: CustomerInfo): boolean {
  return Object.keys(customerInfo.entitlements.active).some(
    (key) => key.toLowerCase() === "premium",
  );
}
