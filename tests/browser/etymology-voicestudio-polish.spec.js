const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://127.0.0.1:5174/index.html';

async function bootApp(page, lang = 'it') {
  await page.setViewportSize({ width: 1366, height: 860 });
  await page.addInitScript((l) => {
    try { localStorage.setItem('glauka.lang', l); } catch {}
  }, lang);
  await page.goto(BASE_URL);
  await page.waitForFunction(() => window.neuroMapApp?.aiStudio);
  await page.evaluate(() => {
    document.querySelectorAll('.nm6-shade').forEach((el) => el.classList.add('hidden'));
  });
}

test('Spiega Etimologia has single Ascolta button and shares quick-read voice preference from Settings across Flashcards and Etymology', async ({ page }) => {
  await bootApp(page, 'it');

  await page.evaluate(() => {
    window.neuromapDesktop = { edgeTts: true };
    document.dispatchEvent(new Event('glauka:ai-ready'));
    const panel = document.getElementById('ai-explain-panel');
    document.getElementById('ai-explain-heading').textContent = 'Etimologia · Glauka';
    document.getElementById('ai-explain-text').textContent =
      'Dal greco glaukos (γλαυκός): brillante, lucente, azzurro-verde, legato alla chiarezza visiva della mente.';
    panel.classList.remove('hidden');
  });

  const explainText = page.locator('#ai-explain-text');
  await expect(explainText).toBeVisible();

  const userSelect = await explainText.evaluate((el) => {
    const s = getComputedStyle(el);
    return s.userSelect || s.webkitUserSelect;
  });
  expect(userSelect).toBe('text');

  const selectedText = await page.evaluate(() => {
    const el = document.getElementById('ai-explain-text');
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    return sel.toString();
  });
  expect(selectedText).toContain('glaukos');

  // Etymology panel keeps ONE single Ascolta button and zero duplicate inline Ascolta selector.
  await expect(page.locator('#ai-explain-panel #ai-explain-speak')).toHaveCount(1);
  await expect(page.locator('#ai-explain-panel #ai-explain-tts-mode')).toHaveCount(0);
  await expect(page.locator('#ai-explain-panel button')).toHaveCount(3); // close (×), Ascolta, Salva

  // Default quick-read mode prefers non-native HD voice ('edge') and speaks using that preference.
  const defaultSpoken = await page.evaluate(() => {
    let recorded = null;
    const studio = window.neuroMapApp.aiStudio;
    const orig = studio.speakWithMode;
    studio.speakWithMode = async function (txt, opts) {
      recorded = { txt, mode: opts?.mode, voice: opts?.voice, explain: Boolean(opts?.explain) };
      return true;
    };
    document.getElementById('ai-explain-speak').click();
    studio.speakWithMode = orig;
    return recorded;
  });
  expect(defaultSpoken?.mode).toBe('edge');
  expect(defaultSpoken?.explain).toBe(true);

  // Configure engine & specific voice centrally in Impostazioni -> Studio e strumenti.
  await page.evaluate(() => {
    document.getElementById('ai-explain-panel').classList.add('hidden');
    window.neuroMapSpeechEngine?.stop?.();
  });
  await page.locator('#gl-settings-quick').click();
  await page.locator('#gl-settings-nav button[data-category="study"]').click();

  const modeSelect = page.locator('#gl-settings-quick-tts-mode');
  const voiceSelect = page.locator('#gl-settings-quick-tts-voice');
  await expect(modeSelect).toBeVisible();
  await expect(voiceSelect).toBeVisible();
  await modeSelect.selectOption('edge');
  await voiceSelect.selectOption('diego');

  expect(await page.evaluate(() => localStorage.getItem('glauka.explain.ttsMode.v1'))).toBe('edge');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('glauka.quickRead.ttsVoices.v1')).edge)).toBe('diego');

  await modeSelect.selectOption('api');
  await voiceSelect.selectOption('nova');
  expect(await page.evaluate(() => localStorage.getItem('glauka.explain.ttsMode.v1'))).toBe('api');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('glauka.quickRead.ttsVoices.v1')).api)).toBe('nova');

  await page.keyboard.press('Escape');

  const explainCustom = await page.evaluate(() => {
    let recorded = null;
    const studio = window.neuroMapApp.aiStudio;
    const orig = studio.speakWithMode;
    studio.speakWithMode = async function (txt, opts) {
      recorded = { txt, mode: opts?.mode, voice: opts?.voice, explain: Boolean(opts?.explain) };
      return true;
    };
    document.getElementById('ai-explain-panel').classList.remove('hidden');
    document.getElementById('ai-explain-speak').click();
    studio.speakWithMode = orig;
    return recorded;
  });
  expect(explainCustom?.mode).toBe('api');
  expect(explainCustom?.voice).toBe('nova');
  expect(explainCustom?.explain).toBe(true);
  expect(explainCustom?.txt).toContain('glaukos');

  // Reload persists settings in Settings and applies them to Flashcards Ascolta too.
  await page.reload();
  await page.waitForFunction(() => window.neuroMapApp?.aiStudio);
  await page.evaluate(() => {
    document.querySelectorAll('.nm6-shade').forEach((el) => el.classList.add('hidden'));
    window.neuroMapApp.studyCards = [{
      id: 'tts-fc-1',
      sourceTabId: window.neuroMapApp.activeTabId,
      sourceNodeId: window.neuroMapApp.state.root.id,
      sourceSignature: window.neuroMapApp.v5Signature(window.neuroMapApp.state.root, window.neuroMapApp.state),
      question: 'Cosa fa il talamus?',
      answer: 'Stazione di relè sensoriale.',
      srStatus: 0,
      sr: { dueAt: 0 },
    }];
    window.neuroMapApp.openFlashcards();
  });

  const flashSpoken = await page.evaluate(() => {
    let recorded = null;
    const studio = window.neuroMapApp.aiStudio;
    const orig = studio.speakWithMode;
    studio.speakWithMode = async function (txt, opts) {
      recorded = { txt, mode: opts?.mode, voice: opts?.voice, explain: Boolean(opts?.explain) };
      return true;
    };
    document.getElementById('glauka-flash-speak').click();
    studio.speakWithMode = orig;
    return recorded;
  });
  expect(flashSpoken?.mode).toBe('api');
  expect(flashSpoken?.voice).toBe('nova');
  expect(flashSpoken?.explain).toBe(false);
  expect(flashSpoken?.txt).toContain('talamus');
});

test('Glauka Studio plugin card shows clear optional guide when absent and syncs voices when installed', async ({ page }) => {
  await bootApp(page, 'it');

  await page.evaluate(() => {
    window.neuromapDesktop = {
      glaukaStudio: {
        status: async () => ({
          installed: false,
          running: false,
          available: false,
          downloadUrl: 'https://glauka.it/#download',
          voices: [],
        }),
        launch: async () => ({ ok: true }),
        speak: async () => ({ ok: false }),
        transcribe: async () => ({ ok: false }),
      },
    };
    window.neuroMapApp.openAIStudio();
    window.neuroMapApp.aiStudio.chooseTask('listen');
  });

  const studioBtn = page.locator('#nm-ai-listen-mode-glauka-studio');
  await studioBtn.click();
  await page.evaluate(() => window.neuroMapApp.aiStudio.refreshGlaukaStudioStatus());

  const card = page.locator('#nm-ai-listen-glauka-studio-card');
  await expect(card).toBeVisible();
  await expect(page.locator('#nm-ai-gs-pill')).toHaveText(/Plugin opzionale/i);
  const guide = page.locator('#nm-ai-gs-guide');
  await expect(guide).toBeVisible();
  await expect(guide).toContainText('Online');
  await expect(page.locator('#nm-ai-gs-download')).toBeVisible();

  await page.evaluate(async () => {
    window.neuromapDesktop.glaukaStudio.status = async () => ({
      installed: true,
      running: false,
      available: true,
      canLaunch: true,
      voices: [{ id: 'giulia-studio', name: 'Giulia Studio (Clone)', cloned: true }],
    });
    await window.neuroMapApp.aiStudio.refreshGlaukaStudioStatus();
  });

  await expect(page.locator('#nm-ai-gs-pill')).toHaveText(/Pronto/i);
  await expect(guide).toBeHidden();
  await expect(page.locator('#nm-ai-gs-open')).toBeVisible();
  await expect(page.locator('#nm-ai-gs-voice-select')).toBeVisible();
});

test('Flashcard Studio clearly identifies Flashcards, builds structured Markdown AI Mode prompts, creates/imports cards, and supports multi-select & Delete All', async ({ page }) => {
  await bootApp(page, 'it');
  page.on('dialog', (d) => d.accept());

  await page.evaluate(() => {
    const app = window.neuroMapApp;
    const root = app.state.root;
    root.text = 'Neuroanatomia';
    root.children = [];
    const b1 = app.state.addChildNode(root.id, app.layoutEngine, 'Ipotalamo');
    app.state.addChildNode(b1.id, app.layoutEngine, 'Funzioni endocrine');
    const b2 = app.state.addChildNode(root.id, app.layoutEngine, 'Talamo');
    app.state.addChildNode(b2.id, app.layoutEngine, 'Relè sensoriale');
    app.studyCards = [
      {
        id: 'old-map-card',
        sourceTabId: 'past-closed-tab',
        sourceNodeId: 'old-node',
        breadcrumb: 'Biologia › Mitocondri',
        question: 'Cosa produce il mitocondrio?',
        answer: 'ATP tramite fosforilazione ossidativa.',
        createdAt: Date.now() - 86400000,
        srStatus: 3,
        sr: { dueAt: Date.now() + 86400000 * 5, lastReviewedAt: Date.now() - 86400000, intervalDays: 5, reviews: 2, lapses: 0 },
      },
    ];
    app.openFlashcards();
  });

  await expect(page.locator('#flash-modal .v4-modal-head strong')).toContainText(/Flashcard/i);

  // Verify Markdown AI Mode prompt divides whole map by branch and respects prompt style options.
  await page.locator('#glauka-study-tools > summary').click();
  await expect(page.locator('#v5-study-prompt-style')).toBeVisible();
  const balancedPrompt = await page.evaluate(() => window.neuroMapApp.v5BuildGoogleCardsPrompt('active', 10, 'balanced').fullPrompt);
  expect(balancedPrompt).toContain('BILANCIATO');
  expect(balancedPrompt).toContain('# Neuroanatomia');
  expect(balancedPrompt).toContain('## 1. Ipotalamo');
  expect(balancedPrompt).toContain('## 2. Talamo');

  await page.locator('#v5-study-prompt-style').selectOption('detailed');
  const detailedPrompt = await page.evaluate(() => window.neuroMapApp.v5BuildGoogleCardsPrompt('active', 12, 'detailed').fullPrompt);
  expect(detailedPrompt).toContain('DETTAGLIATO RAMO PER RAMO');

  // Create manual card without AI.
  await page.locator('#glauka-flash-tabs button').nth(2).click();
  await page.locator('#glauka-compose-q').fill('Dove si trova la valvola tricuspide?');
  await page.locator('#glauka-compose-a').fill('Tra atrio destro e ventricolo destro.');
  await page.locator('#glauka-compose-save').click();

  await expect(page.locator('#flash-card-content .flash-heading')).toHaveText('Dove si trova la valvola tricuspide?');

  // Import Markdown grouped by branch headings from Google AI Mode.
  await page.locator('#glauka-google-paste-text').fill(
    '## 1. Ipotalamo\n- **Qual è un ruolo chiave dell’ipotalamo?** | Coordina sistema endocrino e SNA.\nDomanda | Risposta\nCosa fa il piccolo circolo? | Porta sangue venoso ai polmoni.'
  );
  await page.locator('#glauka-google-paste-import').click();

  // Check Archive & Past tab shows 4 flashcards, filters, and supports Select All + Bulk Delete.
  await page.locator('#glauka-flash-tabs button').nth(1).click();
  await expect(page.locator('#glauka-lib-list .glauka-lib-row')).toHaveCount(4);
  await page.locator('#glauka-lib-search').fill('mitocondrio');
  await expect(page.locator('#glauka-lib-list .glauka-lib-row')).toHaveCount(1);
  await page.locator('#glauka-lib-search').fill('');
  await expect(page.locator('#glauka-lib-list .glauka-lib-row')).toHaveCount(4);

  await page.locator('#glauka-lib-select-toggle').click();
  await page.locator('#glauka-lib-list .glauka-lib-row').first().locator('.glauka-lib-check').click();
  await expect(page.locator('#glauka-lib-bulk-delete')).toContainText('(1)');

  await page.locator('#glauka-lib-select-all').click();
  await expect(page.locator('#glauka-lib-bulk-delete')).toContainText('(4)');
  await page.locator('#glauka-lib-bulk-delete').click();
  await expect(page.locator('#glauka-lib-list .glauka-lib-row')).toHaveCount(0);
});

test('Studia la mappa highlights Flashcards badge and keeps active study tools unburied', async ({ page }) => {
  await bootApp(page, 'it');

  await page.evaluate(() => {
    window.neuroMapApp.studyCards = [
      {
        id: 'due-card-1',
        sourceTabId: window.neuroMapApp.activeTabId,
        sourceNodeId: window.neuroMapApp.state.root.id,
        sourceSignature: window.neuroMapApp.v5Signature(window.neuroMapApp.state.root, window.neuroMapApp.state),
        question: 'Q1',
        answer: 'A1',
        srStatus: 0,
        sr: { dueAt: 0 },
      },
    ];
    window.neuroMapApp._nmLearning?.open('quiz');
  });

  const panel = page.locator('#nm-learn-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('#nm-learn-flash-btn')).toContainText('1');
  await expect(panel.locator('.nm-learn-toolbox')).not.toHaveAttribute('open', '');
  await expect(panel.locator('button.v4-primary', { hasText: /Inizia quiz/i })).toBeVisible();
});
