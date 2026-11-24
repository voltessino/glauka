/* Creative formulas: shared desktop/Android component. */
(function (root) {
  "use strict";
  const { tr, data, button, field, dialog, addGraphic } =
    root.NeuroMapCreativeModules.ui;
  let mathJaxLoading = null;
  function mathJaxUrl() {
    if (typeof root.NeuroMapMathJaxUrl === "string" && root.NeuroMapMathJaxUrl)
      return root.NeuroMapMathJaxUrl;
    return root.GlaukaMobile ? "/assets/mathjax.js" : "/mathjax/mathjax.js";
  }
  function ensureMathJax() {
    if (root.MathJax?.tex2svgPromise && root.MathJax.startup?.promise)
      return root.MathJax.startup.promise;
    if (mathJaxLoading) return mathJaxLoading;
    mathJaxLoading = new Promise((resolve, reject) => {
      const fail = () =>
        reject(
          Error(
            tr(
              "Impossibile caricare il motore delle formule.",
              "Could not load the formula engine.",
            ),
          ),
        );
      const ready = () => {
        if (!root.MathJax?.startup?.promise || !root.MathJax.tex2svgPromise) {
          fail();
          return;
        }
        resolve(root.MathJax.startup.promise);
      };
      const existing = document.querySelector("script[data-neuromap-mathjax]");
      if (existing) {
        if (root.MathJax?.startup?.promise) {
          ready();
          return;
        }
        existing.addEventListener("load", ready, { once: true });
        existing.addEventListener("error", fail, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = mathJaxUrl();
      script.async = true;
      script.dataset.neuromapMathjax = "1";
      script.addEventListener("load", ready, { once: true });
      script.addEventListener("error", fail, { once: true });
      document.head.append(script);
    })
      .catch((error) => {
        mathJaxLoading = null;
        throw error;
      })
      .then((startup) => startup);
    return mathJaxLoading;
  }
  async function formulaSVG(tex, color) {
    if (!tex.trim()) throw Error(tr("Scrivi una formula.", "Enter a formula."));
    if (
      tex.length > 4000 ||
      /\\(?:require|href|url|html\w*|includegraphics|class|style)\b/i.test(tex)
    )
      throw Error(
        tr(
          "Formula non supportata. Usa soltanto notazione matematica.",
          "Unsupported formula. Use mathematical notation only.",
        ),
      );
    await ensureMathJax();
    const container = await root.MathJax.tex2svgPromise(tex, { display: true });
    if (container.querySelector("[data-mjx-error],merror"))
      throw Error(
        tr("Controlla la sintassi LaTeX.", "Check the LaTeX syntax."),
      );
    const svg = container.querySelector("svg");
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const box = svg.getAttribute("viewBox").split(/\s+/).map(Number),
      ratio = box[2] / Math.max(1, box[3]),
      h = Math.max(48, Math.min(180, 48 * Math.max(1, box[3] / 1200))),
      w = Math.max(50, Math.min(1200, h * ratio));
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);
    svg.style.color = color;
    svg.setAttribute("color", color);
    for (const el of svg.querySelectorAll('[fill="currentColor"]'))
      el.setAttribute("fill", color);
    for (const el of svg.querySelectorAll('[stroke="currentColor"]'))
      el.setAttribute("stroke", color);
    return { svg: new XMLSerializer().serializeToString(svg), w, h };
  }
  function formulaDialog(app, image = null) {
    const owner = app.state,
      d = dialog(
        app,
        "nm-formula-dialog",
        "Formula matematica",
        "Mathematical formula",
      );
    d.panel.classList.add("nm-formula-editor");
    const make = (tag, cls = "", text = "") => {
      const el = document.createElement(tag);
      if (cls) el.className = cls;
      if (text) el.textContent = text;
      return el;
    };
    const source = field(
      "nm-formula-source",
      "Formula LaTeX",
      "LaTeX formula",
      "textarea",
    );
    source.input.maxLength = 4000;
    source.input.rows = 4;
    source.input.value = image?.graphic?.tex || String.raw`\frac{a}{b}`;

    const preview = make("div", "nm-formula-preview");
    preview.id = "nm-formula-preview";
    preview.setAttribute("aria-live", "polite");

    const color = field("nm-formula-color", "Colore", "Color", "color");
    // HTML color inputs require six-digit hex; some interface skins use #fff.
    // Match the UI panel instead of the independent map background.
    const skinInk =
      typeof getComputedStyle === "function"
        ? getComputedStyle(document.body).getPropertyValue("--nm-skin-ink").trim()
        : "";
    const safeSkinInk = /^#[0-9a-f]{6}$/i.test(skinInk)
      ? skinInk
      : /^#[0-9a-f]{3}$/i.test(skinInk)
        ? "#" + [...skinInk.slice(1)].map((ch) => ch + ch).join("")
        : root.NeuroMapGraphics?.light?.()
          ? "#172554"
          : "#e2e8f0";
    color.input.value = image?.graphic?.color || safeSkinInk;

    const swatches = make("div", "nm-formula-swatches");
    const baseHexes = [
      [safeSkinInk, "Colore tema", "Theme color"],
      ["#1b2140", "Inchiostro scuro", "Dark ink"],
      ["#ffffff", "Bianco", "White"],
      ["#6441df", "Viola", "Purple"],
      ["#2563eb", "Blu", "Blue"],
      ["#059669", "Verde", "Green"],
      ["#dc2626", "Rosso", "Red"],
      ["#d97706", "Ambra", "Amber"],
    ];
    const seenHex = new Set();
    const paletteSwatches = baseHexes.filter(([hex]) => {
      const k = hex.toLowerCase();
      if (seenHex.has(k)) return false;
      seenHex.add(k);
      return true;
    }).slice(0, 7);

    const insert = button(
      "nm-formula-insert",
      image ? "Aggiorna formula" : "Inserisci formula",
      image ? "Update formula" : "Insert formula",
      () => commit(),
    );
    insert.classList.add("btn-primary", "nm-chart-save-btn");

    const error = make("p", "nm-formula-status");
    error.setAttribute("role", "status");

    let sequence = 0,
      rendered = null;
    const syncSwatches = () => {
      const cur = String(color.input.value || "").toLowerCase();
      if (typeof swatches.querySelectorAll === "function") {
        swatches.querySelectorAll("button[data-swatch]").forEach((b) =>
          b.setAttribute("aria-current", String(b.dataset.swatch === cur)),
        );
      }
    };
    const render = async () => {
      const ticket = ++sequence;
      rendered = null;
      insert.disabled = true;
      syncSwatches();
      try {
        const result = await formulaSVG(source.input.value, color.input.value);
        if (ticket !== sequence) return;
        rendered = {
          ...result,
          tex: source.input.value,
          color: color.input.value,
        };
        preview.replaceChildren(
          new DOMParser().parseFromString(result.svg, "image/svg+xml")
            .documentElement,
        );
        preview.dataset.invalid = "false";
        error.dataset.state = "ok";
        error.textContent = tr(
          "Anteprima aggiornata · formula pronta",
          "Preview updated · formula ready",
        );
        insert.disabled = false;
      } catch (e) {
        if (ticket === sequence) {
          preview.replaceChildren();
          preview.dataset.invalid = "true";
          error.dataset.state = "error";
          error.textContent = e.message;
        }
      }
    };

    const insertSnippet = (snippet, wrapTarget = null) => {
      const ta = source.input;
      const start =
        typeof ta.selectionStart === "number"
          ? ta.selectionStart
          : ta.value.length;
      const end =
        typeof ta.selectionEnd === "number" ? ta.selectionEnd : start;
      const selected = ta.value.slice(start, end);
      const out =
        selected && wrapTarget
          ? wrapTarget.replace("$SEL", selected)
          : snippet;
      ta.value = ta.value.slice(0, start) + out + ta.value.slice(end);
      const caret = start + out.length;
      ta.focus?.();
      ta.setSelectionRange?.(caret, caret);
      render();
    };

    for (const [hex, it, en] of paletteSwatches) {
      const sw = button("", "", "", () => {
        color.input.value = hex;
        render();
      });
      sw.className = "nm-formula-swatch color-swatch";
      sw.dataset.swatch = hex.toLowerCase();
      sw.title = tr(it, en);
      sw.setAttribute("aria-label", tr(it, en));
      const dot = make("i", "nm-formula-swatch-dot");
      if (typeof dot.style?.setProperty === "function") {
        dot.style.setProperty("--nm-swatch", hex);
      } else if (dot.style) {
        dot.style.background = hex;
      }
      sw.append(dot);
      swatches.append(sw);
    }

    const categories = [
      [
        "base",
        "Base",
        "Basic",
        [
          ["a/b", String.raw`\frac{a}{b}`, String.raw`\frac{$SEL}{b}`],
          ["x²", String.raw`x^{2}`, String.raw`{$SEL}^{2}`],
          ["xᵢ", String.raw`x_{i}`, String.raw`{$SEL}_{i}`],
          ["√x", String.raw`\sqrt{x}`, String.raw`\sqrt{$SEL}`],
          ["ⁿ√x", String.raw`\sqrt[n]{x}`, String.raw`\sqrt[n]{$SEL}`],
          ["( )", String.raw`\left( x \right)`, String.raw`\left( $SEL \right)`],
          ["|x|", String.raw`\left| x \right|`, String.raw`\left| $SEL \right|`],
          ["±", String.raw`\pm`],
          ["·", String.raw`\cdot`],
          ["÷", String.raw`\div`],
          ["≠", String.raw`\neq`],
          ["≈", String.raw`\approx`],
          ["≤", String.raw`\le`],
          ["≥", String.raw`\ge`],
          ["∞", String.raw`\infty`],
          ["%", String.raw`\%`],
        ],
      ],
      [
        "calc",
        "Calcolo",
        "Calculus",
        [
          ["∫", String.raw`\int f(x)\,dx`],
          ["∫ₐᵇ", String.raw`\int_{a}^{b} f(x)\,dx`],
          ["d/dx", String.raw`\frac{d}{dx}`],
          ["∂f/∂x", String.raw`\frac{\partial f}{\partial x}`],
          ["∇", String.raw`\nabla`],
          ["Σ", String.raw`\sum_{i=1}^{n} x_i`],
          ["Π", String.raw`\prod_{i=1}^{n} x_i`],
          ["lim", String.raw`\lim_{x \to 0}`],
          ["log", String.raw`\log_{b}(x)`],
          ["ln", String.raw`\ln(x)`],
          ["eˣ", String.raw`e^{x}`],
          ["sin", String.raw`\sin(\theta)`],
          ["cos", String.raw`\cos(\theta)`],
          ["tan", String.raw`\tan(\theta)`],
        ],
      ],
      [
        "matrix",
        "Matrici & Insiemi",
        "Matrices & Sets",
        [
          ["(a b; c d)", String.raw`\begin{pmatrix} a & b \\ c & d \end{pmatrix}`],
          ["Sistema", String.raw`\begin{cases} x + y = 1 \\ x - y = 0 \end{cases}`],
          ["v⃗", String.raw`\vec{v}`, String.raw`\vec{$SEL}`],
          ["û", String.raw`\hat{u}`, String.raw`\hat{$SEL}`],
          ["x̄", String.raw`\overline{x}`, String.raw`\overline{$SEL}`],
          ["C(n,k)", String.raw`\binom{n}{k}`],
          ["∈", String.raw`\in`],
          ["∉", String.raw`\notin`],
          ["∪", String.raw`\cup`],
          ["∩", String.raw`\cap`],
          ["ℝ", String.raw`\mathbb{R}`],
          ["ℕ", String.raw`\mathbb{N}`],
          ["→", String.raw`\rightarrow`],
          ["⇒", String.raw`\Rightarrow`],
          ["⇔", String.raw`\Leftrightarrow`],
        ],
      ],
      [
        "greek",
        "Greco",
        "Greek",
        [
          ["α", String.raw`\alpha`],
          ["β", String.raw`\beta`],
          ["γ", String.raw`\gamma`],
          ["δ", String.raw`\delta`],
          ["ε", String.raw`\varepsilon`],
          ["θ", String.raw`\theta`],
          ["λ", String.raw`\lambda`],
          ["μ", String.raw`\mu`],
          ["π", String.raw`\pi`],
          ["ρ", String.raw`\rho`],
          ["σ", String.raw`\sigma`],
          ["φ", String.raw`\varphi`],
          ["ω", String.raw`\omega`],
          ["Γ", String.raw`\Gamma`],
          ["Δ", String.raw`\Delta`],
          ["Σ", String.raw`\Sigma`],
          ["Φ", String.raw`\Phi`],
          ["Ω", String.raw`\Omega`],
        ],
      ],
    ];

    const tabBar = make("div", "nm-formula-tabs");
    tabBar.setAttribute("role", "tablist");
    const examples = make("div", "nm-formula-keypad");
    let activeCategory = "base";
    const renderKeypad = () => {
      examples.replaceChildren();
      const entry =
        categories.find(([id]) => id === activeCategory) || categories[0];
      for (const [label, tex, wrap] of entry[3]) {
        const keyBtn = button("", label, label, () => insertSnippet(tex, wrap));
        keyBtn.className = "nm-formula-key";
        examples.append(keyBtn);
      }
      if (typeof tabBar.querySelectorAll === "function") {
        tabBar.querySelectorAll("[data-formula-tab]").forEach((t) =>
          t.setAttribute(
            "aria-selected",
            String(t.dataset.formulaTab === activeCategory),
          ),
        );
      }
    };
    for (const [id, it, en] of categories) {
      const tab = button("", it, en, () => {
        activeCategory = id;
        renderKeypad();
      });
      tab.className = "nm-formula-tab";
      tab.dataset.formulaTab = id;
      tab.setAttribute("role", "tab");
      tabBar.append(tab);
    }
    renderKeypad();

    const presetRow = make("div", "nm-formula-presets");
    for (const [it, en, tex] of [
      ["Frazione", "Fraction", String.raw`\frac{a}{b}`],
      ["2° grado", "Quadratic", String.raw`x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`],
      ["Pitagora", "Pythagoras", String.raw`a^2 + b^2 = c^2`],
      ["Gaussiana", "Gaussian", String.raw`\int_{-\infty}^{+\infty} e^{-x^2}\,dx = \sqrt{\pi}`],
      ["Eulero", "Euler", String.raw`e^{i\pi} + 1 = 0`],
    ]) {
      const p = button("", it, en, () => {
        source.input.value = tex;
        render();
        source.input.focus?.();
      });
      p.className = "nm-formula-preset";
      presetRow.append(p);
    }

    const bgToggle = make("div", "nm-formula-bg-toggle");
    let previewSurface = "theme";
    for (const [mode, it, en] of [
      ["theme", "Tema", "Theme"],
      ["light", "Chiaro", "Light"],
      ["dark", "Scuro", "Dark"],
    ]) {
      const b = button("", it, en, () => {
        previewSurface = mode;
        preview.dataset.surface = mode;
        if (typeof bgToggle.querySelectorAll === "function") {
          bgToggle.querySelectorAll("button").forEach((el) =>
            el.setAttribute("aria-pressed", String(el.dataset.surfaceMode === mode)),
          );
        }
      });
      b.dataset.surfaceMode = mode;
      b.setAttribute("aria-pressed", String(mode === previewSurface));
      bgToggle.append(b);
    }

    const commit = () => {
      if (!d.valid() || !rendered || owner !== app.state) return;
      const meta = {
        kind: "formula",
        tex: rendered.tex,
        color: rendered.color,
      };
      if (image) {
        if (!owner.images.includes(image)) return;
        owner.pushHistory();
        Object.assign(image, {
          src: data(rendered.svg),
          graphic: meta,
          naturalWidth: rendered.w,
          naturalHeight: rendered.h,
          width: rendered.w,
          height: rendered.h,
        });
        app.markChanged();
      } else addGraphic(app, rendered.svg, rendered.w, rendered.h, meta);
      d.close();
    };

    const clearBtn = button("", "Pulisci", "Clear", () => {
      source.input.value = "";
      source.input.focus?.();
      render();
    });
    clearBtn.className = "nm-formula-clear-btn";

    source.input.oninput = render;
    source.input.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !insert.disabled) {
        e.preventDefault();
        commit();
      }
    });
    color.input.oninput = render;

    const studio = make("div", "nm-formula-studio");
    const leftCol = make("div", "nm-formula-editor-col");
    const rightCol = make("div", "nm-formula-preview-col");

    const sourceHead = make("div", "nm-formula-bar-head");
    sourceHead.append(
      make("span", "nm-chart-section-head", tr("Codice LaTeX", "LaTeX source")),
      clearBtn,
    );
    const presetsWrap = make("div", "nm-chart-section");
    presetsWrap.append(
      make("div", "nm-chart-section-head", tr("Modelli rapidi", "Quick templates")),
      presetRow,
    );
    const keypadWrap = make("div", "nm-chart-section");
    keypadWrap.append(
      make("div", "nm-chart-section-head", tr("Inserisci simbolo al cursore", "Insert symbol at cursor")),
      tabBar,
      examples,
    );
    leftCol.append(sourceHead, source.input, keypadWrap, presetsWrap);

    const previewHead = make("div", "nm-formula-bar-head");
    previewHead.append(
      make("span", "nm-chart-section-head", tr("Anteprima live", "Live preview")),
      bgToggle,
    );
    const styleCard = make("div", "nm-formula-style-card");
    const styleHead = make("div", "nm-chart-section-head", tr("Colore inchiostro", "Ink color"));
    const colorRow = make("div", "nm-formula-color-row");
    colorRow.append(color.input, swatches);
    styleCard.append(styleHead, colorRow);
    rightCol.append(previewHead, preview, styleCard, error);

    studio.append(leftCol, rightCol);

    const foot = make("div", "nm-chart-footer");
    const footHint = make("span", "nm-chart-help", tr("Le formule vengono salvate come grafica vettoriale nitida.", "Formulas are saved as crisp vector graphics."));
    const footActions = make("div", "nm-chart-footer-actions");
    const cancelBtn = button("nm-formula-cancel", "Annulla", "Cancel", () => d.close());
    cancelBtn.className = "nm-chart-cancel-btn";
    footActions.append(cancelBtn, insert);
    foot.append(footHint, footActions);

    d.panel.append(studio, foot);
    render();
    source.input.focus();
  }
  function symbolsDialog(app) {
    const d = dialog(
        app,
        "nm-symbols-dialog",
        "Simboli e lettere greche",
        "Symbols and Greek letters",
      ),
      node = app.state.findNode(app.state.selectedNodeId) || app.state.root;
    const grid = document.createElement("div");
    grid.className = "nm-symbol-grid";
    const status=document.createElement('p');status.setAttribute('role','status');
    for(const symbol of "α β γ δ ε ζ η θ ι κ λ μ ν ξ ο π ρ σ τ υ φ χ ψ ω Α Β Γ Δ Θ Λ Ξ Π Σ Φ Ψ Ω ± × ÷ ≠ ≈ ≤ ≥ ∞ √ ∑ ∫ ∂ ∇ ° → ↔ ∈ ∉ ∪ ∩ ∅ ℝ ℕ".split(' ')){
      const item=button('',symbol,symbol,()=>{
        if(!d.valid()||!app.state.findNode(node.id))return;
        app.state.pushHistory();node.text+=symbol;app.markChanged();
        root.NeuroMapCreativeModules.ui.appliedBadge(item,true);
        item.setAttribute('aria-pressed','true');
        status.textContent=tr('Aggiunto alla mappa','Added to map')+' · '+symbol;
      });
      const active=String(node.text||'').includes(symbol);item.setAttribute('aria-pressed',String(active));
      root.NeuroMapCreativeModules.ui.appliedBadge(item,active);grid.append(item);
    }
    d.panel.append(status,grid);
  }
  root.NeuroMapCreativeModules.formulas = {
    formulaSVG,
    formulaDialog,
    symbolsDialog,
    ensureMathJax,
  };
})(globalThis);
