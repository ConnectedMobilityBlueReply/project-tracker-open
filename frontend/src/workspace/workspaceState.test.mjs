import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_WORKSPACE_PREFERENCES,
  readWorkspacePreferences,
  writeWorkspacePreferences,
} from './workspaceState.ts';

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
    snapshot() { return Object.fromEntries(values); },
  };
}

test('usa la sidebar aperta quando lo storage è vuoto o invalido', () => {
  assert.deepEqual(readWorkspacePreferences(memoryStorage()), DEFAULT_WORKSPACE_PREFERENCES);
  assert.deepEqual(
    readWorkspacePreferences(memoryStorage({ 'project-tracker:sidebar-collapsed': 'other' })),
    DEFAULT_WORKSPACE_PREFERENCES,
  );
});

test('legge solo la sidebar e rimuove SUBITO le vecchie chiavi di identità', () => {
  const storage = memoryStorage({
    'project-tracker:workspace': 'member',
    'project-tracker:person-id': '7',
    'project-tracker:sidebar-collapsed': '1',
  });
  assert.deepEqual(readWorkspacePreferences(storage), { sidebarCollapsed: true });
  // Pulizia sincrona in lettura: dopo l'inizializzazione nessuna chiave
  // di identità stale resta in storage (nemmeno durante /api/auth/me).
  assert.deepEqual(storage.snapshot(), {
    'project-tracker:sidebar-collapsed': '1',
  });
});

test('scrive solo la sidebar e rimuove le vecchie chiavi di identità', () => {
  const storage = memoryStorage({
    'project-tracker:workspace': 'pm',
    'project-tracker:person-id': '9',
  });
  writeWorkspacePreferences(storage, { sidebarCollapsed: false });
  assert.deepEqual(storage.snapshot(), {
    'project-tracker:sidebar-collapsed': '0',
  });
  // Nessuna chiave di identità/workspace sopravvive sul dispositivo.
  assert.equal('project-tracker:workspace' in storage.snapshot(), false);
  assert.equal('project-tracker:person-id' in storage.snapshot(), false);
});

test('persiste la sidebar chiusa', () => {
  const storage = memoryStorage();
  writeWorkspacePreferences(storage, { sidebarCollapsed: true });
  assert.deepEqual(readWorkspacePreferences(storage), { sidebarCollapsed: true });
  assert.deepEqual(storage.snapshot(), {
    'project-tracker:sidebar-collapsed': '1',
  });
});
