'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const Invitations = require('../invitations');

const { ROLES, ACTIONS } = Invitations;
const INVITE_ID = '018f3a5e-0000-7000-8000-000000000001';
const MAP_ID = '018f3a5e-0000-7000-8000-000000000010';
const DEVICE_ID = '018f3a5e-0000-7000-8000-0000000000aa';
const SIG = 'a'.repeat(64);

describe('F11.4 RBAC and Invitation Security Gates', () => {
  describe('Role-Based Access Control', () => {
    test('Viewer has read-only access', () => {
      assert.equal(Invitations.canRolePerform(ROLES.VIEWER, ACTIONS.READ), true);
      assert.equal(Invitations.canRolePerform(ROLES.VIEWER, ACTIONS.COMMENT), false);
      assert.equal(Invitations.canRolePerform(ROLES.VIEWER, ACTIONS.EDIT_CONTENT), false);
      assert.equal(Invitations.canRolePerform(ROLES.VIEWER, ACTIONS.DELETE_MAP), false);

      assert.doesNotThrow(() => Invitations.assertRoleCan(ROLES.VIEWER, ACTIONS.READ));
      assert.throws(() => Invitations.assertRoleCan(ROLES.VIEWER, ACTIONS.EDIT_CONTENT), /Permission denied/);
    });

    test('Commenter can read and comment, but cannot edit content', () => {
      assert.equal(Invitations.canRolePerform(ROLES.COMMENTER, ACTIONS.READ), true);
      assert.equal(Invitations.canRolePerform(ROLES.COMMENTER, ACTIONS.COMMENT), true);
      assert.equal(Invitations.canRolePerform(ROLES.COMMENTER, ACTIONS.EDIT_CONTENT), false);
      assert.equal(Invitations.canRolePerform(ROLES.COMMENTER, ACTIONS.INVITE), false);

      assert.doesNotThrow(() => Invitations.assertRoleCan(ROLES.COMMENTER, ACTIONS.COMMENT));
      assert.throws(() => Invitations.assertRoleCan(ROLES.COMMENTER, ACTIONS.EDIT_CONTENT), /Permission denied/);
    });

    test('Editor can edit content and rename map, but cannot invite or delete map', () => {
      assert.equal(Invitations.canRolePerform(ROLES.EDITOR, ACTIONS.READ), true);
      assert.equal(Invitations.canRolePerform(ROLES.EDITOR, ACTIONS.EDIT_CONTENT), true);
      assert.equal(Invitations.canRolePerform(ROLES.EDITOR, ACTIONS.RENAME_MAP), true);
      assert.equal(Invitations.canRolePerform(ROLES.EDITOR, ACTIONS.INVITE), false);
      assert.equal(Invitations.canRolePerform(ROLES.EDITOR, ACTIONS.CHANGE_ROLE), false);
      assert.equal(Invitations.canRolePerform(ROLES.EDITOR, ACTIONS.DELETE_MAP), false);

      assert.doesNotThrow(() => Invitations.assertRoleCan(ROLES.EDITOR, ACTIONS.EDIT_CONTENT));
      assert.throws(() => Invitations.assertRoleCan(ROLES.EDITOR, ACTIONS.INVITE), /Permission denied/);
      assert.throws(() => Invitations.assertRoleCan(ROLES.EDITOR, ACTIONS.DELETE_MAP), /Permission denied/);
    });

    test('Owner has full administrative and editing capabilities', () => {
      for (const action of Object.values(ACTIONS)) {
        assert.equal(Invitations.canRolePerform(ROLES.OWNER, action), true);
        assert.doesNotThrow(() => Invitations.assertRoleCan(ROLES.OWNER, action));
      }
    });

    test('Unknown or null roles are rejected with false or exception', () => {
      assert.equal(Invitations.canRolePerform(null, ACTIONS.READ), false);
      assert.equal(Invitations.canRolePerform('hacker', ACTIONS.READ), false);
      assert.throws(() => Invitations.assertRoleCan('hacker', ACTIONS.READ), /Permission denied/);
    });
  });

  describe('Invitation Tokens', () => {
    test('creates frozen invitation token with valid params', () => {
      const future = new Date(Date.now() + 86400000).toISOString();
      const token = Invitations.createInvitationToken({
        inviteId: INVITE_ID,
        mapId: MAP_ID,
        createdByDeviceId: DEVICE_ID,
        targetRole: ROLES.EDITOR,
        expiresAt: future,
        maxUses: 1,
        signature: SIG
      });

      assert.ok(Object.isFrozen(token));
      assert.equal(token.schema, 'GlaukaInviteToken-v1');
      assert.equal(token.targetRole, ROLES.EDITOR);
      assert.equal(token.maxUses, 1);
    });

    test('refuses to generate OWNER invitations', () => {
      const future = new Date(Date.now() + 86400000).toISOString();
      assert.throws(() => Invitations.createInvitationToken({
        inviteId: INVITE_ID,
        mapId: MAP_ID,
        createdByDeviceId: DEVICE_ID,
        targetRole: ROLES.OWNER,
        expiresAt: future,
        signature: SIG
      }), /Cannot create invitation for OWNER/);
    });

    test('rejects malformed UUIDs or invalid parameters', () => {
      const future = new Date(Date.now() + 86400000).toISOString();
      assert.throws(() => Invitations.createInvitationToken({
        inviteId: 'bad-id',
        mapId: MAP_ID,
        createdByDeviceId: DEVICE_ID,
        targetRole: ROLES.VIEWER,
        expiresAt: future,
        signature: SIG
      }), /Invalid UUID/);

      assert.throws(() => Invitations.createInvitationToken({
        inviteId: INVITE_ID,
        mapId: MAP_ID,
        createdByDeviceId: DEVICE_ID,
        targetRole: ROLES.VIEWER,
        expiresAt: 'not-a-date',
        signature: SIG
      }), /Invalid ISO expiresAt/);

      assert.throws(() => Invitations.createInvitationToken({
        inviteId: INVITE_ID,
        mapId: MAP_ID,
        createdByDeviceId: DEVICE_ID,
        targetRole: ROLES.VIEWER,
        expiresAt: future,
        maxUses: 0,
        signature: SIG
      }), /maxUses must be a positive integer/);
    });

    test('validates active token and rejects expired or exhausted token', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 3600000).toISOString();
      const past = new Date(now.getTime() - 3600000).toISOString();

      const validToken = Invitations.createInvitationToken({
        inviteId: INVITE_ID,
        mapId: MAP_ID,
        createdByDeviceId: DEVICE_ID,
        targetRole: ROLES.VIEWER,
        expiresAt: future,
        maxUses: 1,
        signature: SIG
      });

      // Active
      const res = Invitations.validateInvitationToken(validToken, { now: now.toISOString(), usageCount: 0 });
      assert.equal(res.valid, true);
      assert.equal(res.assignedRole, ROLES.VIEWER);
      assert.equal(res.mapId, MAP_ID);

      // Usage exhausted
      assert.throws(
        () => Invitations.validateInvitationToken(validToken, { now: now.toISOString(), usageCount: 1 }),
        /usage limit exceeded/
      );

      // Expired token
      const expiredToken = Invitations.createInvitationToken({
        inviteId: INVITE_ID,
        mapId: MAP_ID,
        createdByDeviceId: DEVICE_ID,
        targetRole: ROLES.COMMENTER,
        expiresAt: past,
        signature: SIG
      });
      assert.throws(
        () => Invitations.validateInvitationToken(expiredToken, { now: now.toISOString(), usageCount: 0 }),
        /expired/
      );
    });
  });
});
