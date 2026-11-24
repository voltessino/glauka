/* F11.4 — Invitations, role-based access control (RBAC) and permission gates.
 * Enforces server-side and client-side invariants:
 * - Roles: OWNER, EDITOR, COMMENTER, VIEWER
 * - Viewers/Commenters can NEVER modify map structure or nodes
 * - Single-use or expiring invitation tokens
 * - Never leaks owner tokens or creates public unauthenticated write links
 */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GlaukaMapInvitations = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const ROLES = Object.freeze({
    OWNER: 'owner',
    EDITOR: 'editor',
    COMMENTER: 'commenter',
    VIEWER: 'viewer'
  });

  const ACTIONS = Object.freeze({
    READ: 'read',
    COMMENT: 'comment',
    EDIT_CONTENT: 'edit_content',
    RENAME_MAP: 'rename_map',
    INVITE: 'invite',
    CHANGE_ROLE: 'change_role',
    REVOKE_ACCESS: 'revoke_access',
    DELETE_MAP: 'delete_map'
  });

  const ROLE_PERMISSIONS = Object.freeze({
    [ROLES.VIEWER]: new Set([ACTIONS.READ]),
    [ROLES.COMMENTER]: new Set([ACTIONS.READ, ACTIONS.COMMENT]),
    [ROLES.EDITOR]: new Set([
      ACTIONS.READ,
      ACTIONS.COMMENT,
      ACTIONS.EDIT_CONTENT,
      ACTIONS.RENAME_MAP
    ]),
    [ROLES.OWNER]: new Set([
      ACTIONS.READ,
      ACTIONS.COMMENT,
      ACTIONS.EDIT_CONTENT,
      ACTIONS.RENAME_MAP,
      ACTIONS.INVITE,
      ACTIONS.CHANGE_ROLE,
      ACTIONS.REVOKE_ACCESS,
      ACTIONS.DELETE_MAP
    ])
  });

  const TOKEN_SCHEMA = 'GlaukaInviteToken-v1';
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function canRolePerform(role, action) {
    if (!role || !Object.values(ROLES).includes(role)) return false;
    const permitted = ROLE_PERMISSIONS[role];
    return permitted ? permitted.has(action) : false;
  }

  function assertRoleCan(role, action) {
    if (!canRolePerform(role, action)) {
      throw Error(`Permission denied: role '${role}' cannot perform '${action}'`);
    }
  }

  function createInvitationToken({
    inviteId,
    mapId,
    createdByDeviceId,
    targetRole,
    expiresAt,
    maxUses = 1,
    signature
  } = {}) {
    if (!UUID_REGEX.test(inviteId) || !UUID_REGEX.test(mapId) || !UUID_REGEX.test(createdByDeviceId)) {
      throw Error('Invalid UUID for inviteId, mapId or createdByDeviceId');
    }
    if (![ROLES.EDITOR, ROLES.COMMENTER, ROLES.VIEWER].includes(targetRole)) {
      throw Error('Cannot create invitation for OWNER role; ownership transfer requires explicit two-party flow');
    }
    if (typeof expiresAt !== 'string' || Number.isNaN(Date.parse(expiresAt))) {
      throw Error('Invalid ISO expiresAt timestamp');
    }
    if (!Number.isSafeInteger(maxUses) || maxUses < 1) {
      throw Error('maxUses must be a positive integer');
    }
    if (typeof signature !== 'string' || signature.length < 32) {
      throw Error('Cryptographic signature required');
    }

    return Object.freeze({
      schema: TOKEN_SCHEMA,
      inviteId,
      mapId,
      createdByDeviceId,
      targetRole,
      expiresAt,
      maxUses,
      signature
    });
  }

  function validateInvitationToken(token, { now = new Date().toISOString(), usageCount = 0 } = {}) {
    if (!token || typeof token !== 'object' || token.schema !== TOKEN_SCHEMA) {
      throw Error('Invalid invitation token schema');
    }
    if (!UUID_REGEX.test(token.inviteId) || !UUID_REGEX.test(token.mapId) || !UUID_REGEX.test(token.createdByDeviceId)) {
      throw Error('Invalid token identifiers');
    }
    if (![ROLES.EDITOR, ROLES.COMMENTER, ROLES.VIEWER].includes(token.targetRole)) {
      throw Error('Invalid invitation target role');
    }
    if (Date.parse(token.expiresAt) <= Date.parse(now)) {
      throw Error('Invitation token has expired');
    }
    if (usageCount >= token.maxUses) {
      throw Error('Invitation token usage limit exceeded');
    }
    return Object.freeze({
      valid: true,
      mapId: token.mapId,
      assignedRole: token.targetRole,
      inviteId: token.inviteId
    });
  }

  return Object.freeze({
    ROLES,
    ACTIONS,
    canRolePerform,
    assertRoleCan,
    createInvitationToken,
    validateInvitationToken
  });
});
