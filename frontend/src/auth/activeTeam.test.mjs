import assert from 'node:assert/strict';
import test from 'node:test';
import { ALL_TEAMS_STORED_VALUE, canEnterTeams, canUseAllTeams, isPureManager, parseStoredTeamId, resolveActiveTeam, resolveAggregateMode, resolveAllTeamsMode, toUser } from './activeTeam.ts';

const TEAMS = [
  { id: 4, name: 'Alfa', role: 'admin' },
  { id: 9, name: 'Beta', role: 'member' },
];
const ACCOUNT = { personId: 7, name: 'Mario', email: 'e@x.it', platformAdmin: false, teams: TEAMS };

test('id salvato: solo interi positivi', () => {
  assert.equal(parseStoredTeamId('9'), 9);
  assert.equal(parseStoredTeamId(null), null);
  assert.equal(parseStoredTeamId('abc'), null);
  assert.equal(parseStoredTeamId('-1'), null);
  assert.equal(parseStoredTeamId('1.5'), null);
});

test('team attivo: quello salvato se ancora valido, altrimenti il primo', () => {
  assert.equal(resolveActiveTeam(TEAMS, 9)?.id, 9);
  assert.equal(resolveActiveTeam(TEAMS, 99)?.id, 4);
  assert.equal(resolveActiveTeam(TEAMS, null)?.id, 4);
  assert.equal(resolveActiveTeam([], 4), null);
});

test('utente derivato dal team attivo; nessun team → null', () => {
  assert.deepEqual(toUser(ACCOUNT, TEAMS[1]), {
    personId: 7, name: 'Mario', email: 'e@x.it', platformAdmin: false,
    manager: false, readOnly: false, allTeams: false,
    appRole: 'member', teamId: 9, teamName: 'Beta',
  });
  assert.equal(toUser(ACCOUNT, null), null);
});

test('il manager è in sola lettura nei team marcati read_only', () => {
  const manager = { ...ACCOUNT, manager: true };
  const readOnlyTeam = { id: 4, name: 'Alfa', role: 'pm', read_only: true };
  const user = toUser(manager, readOnlyTeam);
  assert.equal(user.manager, true);
  assert.equal(user.readOnly, true);
  assert.equal(user.appRole, 'pm');
});

test('Tutti i Team: solo manager e super-admin', () => {
  assert.equal(canUseAllTeams({ manager: false, platformAdmin: false }), false);
  assert.equal(canUseAllTeams({ manager: true, platformAdmin: false }), true);
  assert.equal(canUseAllTeams({ manager: false, platformAdmin: true }), true);
});

test('modalità iniziale: il manager parte in Tutti i Team, la scelta salvata vince', () => {
  const manager = { manager: true, platformAdmin: false };
  const superAdmin = { manager: false, platformAdmin: true };
  assert.equal(resolveAllTeamsMode(manager, null), true);
  assert.equal(resolveAllTeamsMode(manager, ALL_TEAMS_STORED_VALUE), true);
  // Il manager puro non sceglie un team: l'id salvato è ignorato.
  assert.equal(resolveAllTeamsMode(manager, '5'), true);
  // Valore salvato non valido: come nessuna scelta.
  assert.equal(resolveAllTeamsMode(manager, 'abc'), true);
  // Il super-admin non parte in Tutti i Team, ma può sceglierlo e mantiene la scelta di un team.
  assert.equal(resolveAllTeamsMode(superAdmin, null), false);
  assert.equal(resolveAllTeamsMode(superAdmin, ALL_TEAMS_STORED_VALUE), true);
  assert.equal(resolveAllTeamsMode({ manager: true, platformAdmin: true }, '5'), false);
});

test('manager puro: solo manager senza super-admin, non sceglie mai un team', () => {
  assert.equal(isPureManager({ manager: true, platformAdmin: false }), true);
  assert.equal(isPureManager({ manager: false, platformAdmin: true }), false);
  assert.equal(isPureManager({ manager: true, platformAdmin: true }), false);
  assert.equal(isPureManager({ manager: false, platformAdmin: false }), false);
  assert.equal(canEnterTeams({ manager: true, platformAdmin: false }), false);
  assert.equal(canEnterTeams({ manager: false, platformAdmin: true }), true);
  assert.equal(canEnterTeams({ manager: true, platformAdmin: true }), true);
  assert.equal(canEnterTeams({ manager: false, platformAdmin: false }), true);
});

test('chi non è manager né super-admin non entra mai in Tutti i Team, neanche con il valore salvato', () => {
  assert.equal(resolveAllTeamsMode({ manager: false, platformAdmin: false }, ALL_TEAMS_STORED_VALUE), false);
  const user = toUser(ACCOUNT, TEAMS[1], true);
  assert.equal(user.allTeams, false);
  assert.equal(user.readOnly, false);
});

test('in Tutti i Team l\'utente ha allTeams e non readOnly, anche per il manager', () => {
  const superAdmin = { ...ACCOUNT, platformAdmin: true };
  const manager = { ...ACCOUNT, manager: true };
  const user = toUser(superAdmin, TEAMS[0], true);
  assert.equal(user.allTeams, true);
  assert.equal(user.readOnly, false);
  assert.equal(toUser(superAdmin, TEAMS[0]).readOnly, false);
  assert.equal(toUser(manager, TEAMS[0], true).readOnly, false);
  assert.equal(toUser(manager, { ...TEAMS[0], read_only: true }, true).readOnly, true);
});

test('modalità applicata al cambio account: il manager puro resta in Tutti i Team anche con preferenza false', () => {
  const manager = { manager: true, platformAdmin: false };
  // Dopo createTeam/acceptInvite la preferenza è false: il manager puro non deve uscire da Tutti i Team.
  assert.equal(resolveAggregateMode(manager, false, '5'), true);
  assert.equal(resolveAggregateMode(manager, null, null), true);
  assert.equal(resolveAggregateMode(manager, true, null), true);
});

test('modalità applicata al cambio account: il super-admin mantiene il team scelto con preferenza false', () => {
  const superAdmin = { manager: false, platformAdmin: true };
  assert.equal(resolveAggregateMode(superAdmin, false, '5'), false);
  assert.equal(resolveAggregateMode(superAdmin, true, null), true);
  assert.equal(resolveAggregateMode(superAdmin, null, null), false);
});

test('modalità applicata al cambio account: utente comune mai in Tutti i Team', () => {
  const member = { manager: false, platformAdmin: false };
  assert.equal(resolveAggregateMode(member, true, null), false);
  assert.equal(resolveAggregateMode(member, null, ALL_TEAMS_STORED_VALUE), false);
});

test('modalità applicata al cambio account: manager anche super-admin con preferenza false resta sul team', () => {
  const managerAdmin = { manager: true, platformAdmin: true };
  assert.equal(resolveAggregateMode(managerAdmin, false, '5'), false);
});
