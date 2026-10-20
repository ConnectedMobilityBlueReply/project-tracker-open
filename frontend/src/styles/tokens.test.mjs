import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = (await readFile(new URL('./trackline.css', import.meta.url), 'utf8'))
  .replace(/\/\*[\s\S]*?\*\//g, '');
const theme = css.match(/@theme\s+inline\s*\{([^}]*)\}/)?.[1] ?? '';
const rootRules = [...css.matchAll(/(:root[^{}]*)\{([^{}]*)\}/g)]
  .map((match) => ({ selector: match[1].trim(), declarations: match[2] }));

function property(declarations, name) {
  return declarations.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+);`))?.[1].trim();
}

function rootProperty(name) {
  return rootRules.map((rule) => property(rule.declarations, name))
    .find((value) => value !== undefined);
}

test('rounded-card conserva il raggio applicativo e la utility Tailwind', () => {
  assert.equal(rootProperty('--card-radius'), 'var(--radius)');
  assert.equal(property(theme, '--radius-card'), 'var(--card-radius)');
});

test('font-display usa il font heading di Koala', () => {
  assert.equal(property(theme, '--font-display'), 'var(--font-heading)');
});

test('la sidebar segue il canvas chiaro e genera le utility', () => {
  const base = rootRules.find((rule) => rule.selector === ':root' && property(rule.declarations, '--sidebar') !== undefined);
  assert.equal(property(base.declarations, '--sidebar'), 'var(--canvas)');
  assert.equal(property(base.declarations, '--sidebar-foreground'), 'var(--foreground)');
  for (const role of ['sidebar', 'sidebar-foreground', 'sidebar-primary', 'sidebar-primary-foreground',
    'sidebar-accent', 'sidebar-accent-foreground', 'sidebar-border', 'sidebar-ring']) {
    assert.equal(property(theme, `--color-${role}`), `var(--${role})`, `color-${role}`);
  }
});

test('accento viola morbido (light) e raggio 8px', () => {
  const light = rootRules.find((rule) => rule.selector === ':root:not(.dark)');
  assert.equal(property(light.declarations, '--primary'), 'var(--brand)');
  assert.equal(property(light.declarations, '--ring'), 'var(--brand)');
  assert.equal(rootProperty('--radius'), '0.5rem');
});

test('primario scuro leggibile come testo e come riempimento', () => {
  const dark = css.match(/(?:^|\})\s*\.dark\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.equal(property(dark, '--primary'), '#7c80f5');
  assert.equal(property(dark, '--primary-foreground'), '#13151f');
  assert.equal(property(dark, '--ring'), '#7c80f5');
});

test('i sei ruoli chart usano la palette dati e generano le utility Tailwind', () => {
  const palette = ['data-blue', 'data-orange', 'data-green', 'brand-tile', 'data-purple', 'data-gray'];
  assert.equal(rootProperty('--data-purple'), '#8b5cf6');
  assert.equal(rootProperty('--data-gray'), '#9ca3af');

  for (const [index, color] of palette.entries()) {
    const role = `chart-${index + 1}`;
    assert.equal(rootProperty(`--${role}`), `var(--${color})`, role);
    assert.equal(property(theme, `--color-${role}`), `var(--${role})`, `color-${role}`);
  }
});

for (const orientation of ['horizontal', 'vertical']) {
  test(`data-${orientation} legge data-orientation di Base UI`, () => {
    const variant = new RegExp(
      `@custom-variant\\s+data-${orientation}\\s+\\(&:where\\(\\[data-orientation=["']${orientation}["']\\]\\)\\);`,
    );
    assert.ok(variant.test(css), `manca la variante data-${orientation} basata su data-orientation`);
  });
}

test('il canvas chiaro esclude il tema scuro da ogni selettore', () => {
  const canvasRules = rootRules.filter((rule) => property(rule.declarations, '--canvas') !== undefined);
  assert.ok(canvasRules.length > 0, 'trackline.css deve definire --canvas');

  for (const { selector } of canvasRules) {
    for (const branch of selector.split(',')) {
      assert.ok(branch.includes(':not(.dark)'), `--canvas non deve sovrascrivere dark: ${branch.trim()}`);
    }
  }
});

test('nessun riferimento ai temi rimossi nei fogli di stile', async () => {
  const koala = (await readFile(new URL('./koala.css', import.meta.url), 'utf8'))
    .replace(/\/\*[\s\S]*?\*\//g, '');
  for (const removed of ['.cream', '.moonlight', 'data-accent', 'data-concept']) {
    assert.ok(!koala.includes(removed), `koala.css contiene ancora ${removed}`);
    assert.ok(!css.includes(removed), `trackline.css contiene ancora ${removed}`);
  }
});

test('superfici della shell definite con fallback e override light', () => {
  for (const token of ['--panel', '--topbar', '--search-field']) {
    assert.match(css, new RegExp(`${token}:`));
    assert.match(css, new RegExp(`--color-${token.slice(2)}: var\\(${token}\\)`));
  }
});

const THEMES_SCURI = ['dark'];
const lightRule = rootRules.find((rule) =>
  THEMES_SCURI.every((theme) => rule.selector.includes(`:not(.${theme})`))
  && property(rule.declarations, '--canvas') !== undefined);

const LIGHT_PALETTE = {
  '--canvas': '#eeeef0',
  '--panel': '#ffffff',
  '--topbar': '#f6f6f8',
  '--search-field': '#f6f6f8',
  '--surface-soft': '#f6f6f8',
  '--chip': '#ecebf0',
  '--chip-active': '#e7e3fa',
  '--brand': '#7467cf',
  '--brand-foreground': '#ffffff',
  '--primary': 'var(--brand)',
  '--primary-foreground': '#ffffff',
  '--ring': 'var(--brand)',
  '--pill-purple': '#f0edfe',
  '--brand-tile': '#7467cf',
};

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

test('il tema light usa la palette viola morbido', () => {
  assert.ok(lightRule, 'manca il blocco light in trackline.css');
  for (const [token, value] of Object.entries(LIGHT_PALETTE)) {
    assert.equal(property(lightRule.declarations, token), value, token);
  }
});

test('il viola morbido vive solo nel tema light', () => {
  for (const rule of rootRules.filter((candidate) => candidate !== lightRule)) {
    assert.equal(property(rule.declarations, '--brand-foreground'), undefined, `--brand-foreground in ${rule.selector}`);
    assert.doesNotMatch(rule.declarations, /#7467cf/i, rule.selector);
  }
});

test('testo bianco su accent rispetta AA (4,5:1)', () => {
  const brand = property(lightRule.declarations, '--brand');
  const ratio = 1.05 / (luminance(brand) + 0.05);
  assert.ok(ratio >= 4.5, `contrasto ${ratio.toFixed(2)}:1 su ${brand}`);
});

test('i nuovi ruoli hanno fallback sugli altri temi e utility Tailwind', () => {
  const fallback = rootRules.find((rule) => rule.selector === ':root');
  for (const token of ['--surface-soft', '--chip', '--chip-active']) {
    assert.ok(property(fallback.declarations, token), `fallback ${token}`);
    assert.equal(property(theme, `--color-${token.slice(2)}`), `var(${token})`, `color-${token.slice(2)}`);
  }
});

test('il track Progress light batte la variabile locale del componente', () => {
  const rule = rootRules.find((candidate) => candidate.selector.includes('[data-slot="progress-track"]'));
  assert.ok(rule, 'manca la regola sul track Progress');
  for (const theme of THEMES_SCURI) {
    assert.ok(rule.selector.includes(`:not(.${theme})`), `deve escludere ${theme}`);
  }
  assert.equal(property(rule.declarations, '--progress-track'), '#edecf2');
});

test('il chip attivo si distingue dal chip a riposo e ha un testo leggibile in ogni tema', () => {
  const fallback = rootRules.find((rule) => rule.selector === ':root');
  assert.notEqual(property(fallback.declarations, '--chip-active'), property(fallback.declarations, '--chip'));
  assert.equal(property(fallback.declarations, '--chip-active-foreground'), 'var(--foreground)');
  assert.equal(property(lightRule.declarations, '--chip-active-foreground'), 'var(--brand-strong)');
  assert.equal(property(theme, '--color-chip-active-foreground'), 'var(--chip-active-foreground)');
});

test('chip e ProjectKpiStrip usano il testo body (AA su superfici morbide), non muted-foreground', async () => {
  const tabs = await readFile(new URL('../components/ui/tabs/tabs.tsx', import.meta.url), 'utf8');
  const chip = tabs.slice(tabs.indexOf('export function TabsTriggerCount'), tabs.indexOf('export function TabsContent'));
  assert.match(chip, /text-body/);
  assert.match(chip, /group-data-\[state=active\]\/tabs-trigger:text-chip-active-foreground/);
  assert.doesNotMatch(chip, /text-muted-foreground|text-brand-strong/);

  const kpi = await readFile(new URL('../components/progetto/ProjectKpiStrip.tsx', import.meta.url), 'utf8');
  assert.match(kpi, /text-body/);
  assert.doesNotMatch(kpi, /text-muted-foreground/);
});

test('chip di stato pieni leggibili: inchiostro bianco in chiaro, scuro in scuro', () => {
  const light = rootRules.find((rule) => rule.selector === ':root:not(.dark)');
  const dark = css.match(/(?:^|\})\s*\.dark\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.equal(property(light.declarations, '--status-ink'), '#ffffff');
  assert.equal(property(dark, '--status-ink'), '#13151f');
  assert.equal(property(theme, '--color-status-ink'), 'var(--status-ink)');

  const tones = {
    blue: ['var(--info-strong)', 'var(--info)'],
    green: ['var(--success-strong)', 'var(--success)'],
    amber: ['var(--warning-strong)', 'var(--warning)'],
    red: ['var(--destructive-strong)', 'var(--destructive)'],
    orange: ['var(--orange)', 'var(--orange)'],
    purple: ['var(--purple)', 'var(--purple)'],
    neutral: ['var(--muted-foreground)', 'var(--muted-foreground)'],
  };
  for (const [tone, [lightValue, darkValue]] of Object.entries(tones)) {
    assert.equal(property(light.declarations, `--status-${tone}`), lightValue, `light --status-${tone}`);
    assert.equal(property(dark, `--status-${tone}`), darkValue, `dark --status-${tone}`);
    assert.equal(property(theme, `--color-status-${tone}`), `var(--status-${tone})`, `color-status-${tone}`);
  }
});

test('i temi non curati mantengono l\'accento indaco di main', () => {
  const base = rootRules.find((rule) => rule.selector === ':root' && property(rule.declarations, '--brand') !== undefined);
  assert.equal(property(base.declarations, '--brand'), '#4b50e7');
});

test('in tema scuro i link restano AA sul fondo scuro', () => {
  const dark = css.match(/(?:^|\})\s*\.dark\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.equal(property(dark, '--link'), '#7c80f5');
});
