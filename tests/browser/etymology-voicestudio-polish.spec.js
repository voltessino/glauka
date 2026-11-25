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

test('Spiega Etimologia text is selectable and persists Ascolta con engine preference', async ({ page }) => {
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

  const modeSelect = page.locator('#ai-explain-tts-mode');
  await expect(modeSelect).toBeVisible();
  await modeSelect.selectOption('api');
  expect(await page.evaluate(() => localStorage.getItem('glauka.explain.ttsMode.v1'))).toBe('api');

  const spokenMode = await page.evaluate(() => {
    let recorded = null;
    const studio = window.neuroMapApp.aiStudio;
    const orig = studio.speakWithMode;
    studio.speakWithMode = async function (txt, opts) {
      recorded = { txt, mode: opts?.mode, explain: Boolean(opts?.explain) };
      return true;
    };
    document.getElementById('ai-explain-speak').click();
    studio.speakWithMode = orig;
    return recorded;
  });
  expect(spokenMode?.mode).toBe('api');
  expect(spokenMode?.explain).toBe(true);
  expect(spokenMode?.txt).toContain('glaukos');

  await page.reload();
  await page.waitForFunction(() => window.neuroMapApp?.aiStudio && document.querySelector('#ai-explain-tts-mode option[value="api"]'));
  await expect(page.locator('#ai-explain-tts-mode')).toHaveValue('api');
});

test('VoiceStudio card shows clear offline guide when server is off and unlocks controls when active', async ({ page }) => {
  await bootApp(page, 'it');

  await page.evaluate(() => {
    window.neuromapDesktop = {
      voiceStudio: {
        status: async () => ({
          available: false,
          url: 'http://127.0.0.1:3900',
          voices: [],
          error: 'connection refused',
        }),
        speak: async () => ({ ok: false }),
        transcribe: async () => ({ ok: false }),
      },
    };
    window.neuroMapApp.openAIStudio();
    window.neuroMapApp.aiStudio.chooseTask('listen');
  });

  const studioBtn = page.locator('.nm-ai-listen-modes button', { hasText: /VoiceStudio/i });
  await studioBtn.click();
  await page.evaluate(() => window.neuroMapApp.aiStudio.refreshVoiceStudioStatus());

  const card = page.locator('#nm-ai-listen-voicestudio-card');
  await expect(card).toBeVisible();
  await expect(page.locator('#nm-ai-vs-pill')).toHaveText(/Server spento/i);
  const guide = page.locator('#nm-ai-vs-guide');
  await expect(guide).toBeVisible();
  await expect(guide).toContainText('Online (gratis)');
  await expect(guide).toContainText('localhost:3900');

  await page.evaluate(async () => {
    window.neuromapDesktop.voiceStudio.status = async () => ({
      available: true,
      url: 'http://127.0.0.1:3900',
      voices: [{ id: 'giulia-studio', name: 'Giulia Studio (Clone)' }],
    });
    await window.neuroMapApp.aiStudio.refreshVoiceStudioStatus();
  });

  await expect(page.locator('#nm-ai-vs-pill')).toHaveText(/Connesso/i);
  await expect(guide).toBeHidden();
  await expect(page.locator('#nm-ai-vs-voice-select')).toBeVisible();
});

test('Flashcard Studio clearly identifies Flashcards, creates cards manually, imports Google AI Mode lines, and browses past decks', async ({ page }) => {
  await bootApp(page, 'it');

  await page.evaluate(() => {
    window.neuroMapApp.studyCards = [
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
    window.neuroMapApp.openFlashcards();
  });

  await expect(page.locator('#flash-modal .v4-modal-head strong')).toContainText(/Flashcard/i);

  // Create manual card without AI.
  await page.locator('#glauka-flash-tabs button').nth(2).click();
  await page.locator('#glauka-compose-q').fill('Dove si trova la valvola tricuspide?');
  await page.locator('#glauka-compose-a').fill('Tra atrio destro e ventricolo destro.');
  await page.locator('#glauka-compose-save').click();

  await expect(page.locator('#flash-card-content .flash-heading')).toHaveText('Dove si trova la valvola tricuspide?');

  // Import from Google AI Mode format skipping header line.
  await page.locator('#glauka-study-tools > summary').click();
  await page.locator('#glauka-google-paste-text').fill(
    'Domanda | Risposta\nCosa fa il piccolo circolo? | Porta sangue venoso ai polmoni.'
  );
  await page.locator('#glauka-google-paste-import').click();

  // Check Archive & Past tab shows all 3 real flashcards and searches cleanly.
  await page.locator('#glauka-flash-tabs button').nth(1).click();
  await expect(page.locator('#glauka-lib-list .glauka-lib-row')).toHaveCount(3);
  await page.locator('#glauka-lib-search').fill('mitocondrio');
  await expect(page.locator('#glauka-lib-list .glauka-lib-row')).toHaveCount(1);
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
