export const STORE_PERMISSIONS = ["products:write", "revenue:read"] as const;

export type StorePermission = typeof STORE_PERMISSIONS[number];

export function hasStorePermission(
  profile: { role: "admin" | "collaborator"; permissions?: StorePermission[] },
  permission: StorePermission,
) {
  return profile.role === "admin" || profile.permissions?.includes(permission) === true;
}
