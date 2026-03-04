export type OrgRole = "owner" | "admin" | "developer" | "viewer";

const ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner: 4,
  admin: 3,
  developer: 2,
  viewer: 1,
};

export function hasRole(userRole: OrgRole, requiredRole: OrgRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function canManageMembers(role: OrgRole): boolean {
  return hasRole(role, "admin");
}

export function canManageProjects(role: OrgRole): boolean {
  return hasRole(role, "developer");
}

export function canManageBilling(role: OrgRole): boolean {
  return hasRole(role, "admin");
}

export function canDeleteOrg(role: OrgRole): boolean {
  return role === "owner";
}

export function canManageApiKeys(role: OrgRole): boolean {
  return hasRole(role, "developer");
}
