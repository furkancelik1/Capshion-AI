import { CustomerInfo } from "react-native-purchases";

export function hasPremiumEntitlement(customerInfo?: CustomerInfo | null): boolean {
  if (!customerInfo) return false;

  // 1. Entitlements.active içinde aktif herhangi bir yetki var mı?
  const activeKeys = Object.keys(customerInfo.entitlements?.active || {});
  if (activeKeys.length > 0) return true;

  // 2. Google Play / App Store üzerinde aktif bir abonelik ID'si var mı?
  if (Array.isArray(customerInfo.activeSubscriptions) && customerInfo.activeSubscriptions.length > 0) {
    return true;
  }

  // 3. İleri tarihli herhangi bir abonelik geçerlilik süresi var mı?
  const expirationDates = Object.values(customerInfo.allExpirationDates || {});
  const now = new Date().toISOString();
  if (expirationDates.some((exp) => exp && exp > now)) {
    return true;
  }

  return false;
}
