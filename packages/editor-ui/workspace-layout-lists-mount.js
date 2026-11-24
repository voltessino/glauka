  function mountLists(app) {
    const old = document.getElementById("nm68-bullets");
    if (!old || document.getElementById("nm-list-picker")) return;
    old.hidden = true;
    const host = document.createElement("span");
    host.id = "nm-list-picker";
    host.className = "nm6-skiptranslate";
    const trigger = document.createElement("button");
    trigger.id = "nm-list-trigger";
    trigger.type = "button";
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", "nm-list-menu");
    const menu = document.createElement("div");
    menu.id = "nm-list-menu";
    menu.className = "nm-list-grid nm6-skiptranslate";
    menu.setAttribute("role", "menu");
    menu.hidden = true;
    const nativePopover = typeof menu.showPopover === "function";
    if (nativePopover) menu.setAttribute("popover", "auto");
    host.append(trigger);
    old.after(host);
    document.body.append(menu);
    const close = (focus = false) => {
      if (nativePopover && menu.matches(":popover-open")) menu.hidePopover();
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      if (focus) trigger.focus({ preventScroll: true });
    };
    app._nmCloseListPicker = close;
    // The inspector may also be hidden by its own close button, outside the
    // workspace coordinator. Do not leave a body-level popover over the map.
    const inspector = document.getElementById("inspector-sidebar");
    if (inspector && typeof MutationObserver === "function") {
      const observer = new MutationObserver(() => {
        if (inspector.hidden || inspector.classList.contains("hidden") ||
            inspector.classList.contains("collapsed")) close();
      });
      observer.observe(inspector, {
        attributes: true, attributeFilter: ["hidden", "class", "style"]
      });
    }
    // A floating palette cannot stay at stale coordinates while its trigger
    // moves inside a scrolling inspector (including nested scroll containers).
    let openedAnchor=null;
    inspector?.addEventListener("scroll", () => {
      if (menu.hidden || !openedAnchor) return;
      const anchor=trigger.getBoundingClientRect();
      // WebKit may deliver an already completed scroll after opening the
      // popover. Dismiss only when the painted trigger actually moved.
      if(Math.abs(anchor.top-openedAnchor.top)>.5 || Math.abs(anchor.left-openedAnchor.left)>.5)close();
    }, { capture: true, passive: true });
    const open = () => {
      menu.hidden = false;
      // Clear a previous short-viewport restriction before measuring again.
      menu.style.maxHeight = "";
      menu.style.width = Math.max(0, Math.min(240, innerWidth - 16)) + "px";
      if (nativePopover && !menu.matches(":popover-open")) menu.showPopover();
      const placement = placeListMenu(trigger.getBoundingClientRect(),
        menu.offsetHeight, { width: innerWidth, height: innerHeight });
      menu.style.width = placement.width + "px";
      menu.style.left = placement.left + "px";
      menu.style.top = placement.top + "px";
      menu.style.maxHeight = placement.maxHeight + "px";
      trigger.setAttribute("aria-expanded", "true");
      openedAnchor=trigger.getBoundingClientRect();
    };
    trigger.addEventListener("click", () => (menu.hidden ? open() : close()));
    trigger.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        open();
        menu.querySelector("button")?.focus();
      }
    });
    menu.addEventListener("toggle", () => {
      if (nativePopover && !menu.matches(":popover-open")) {
        menu.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (
          !menu.hidden &&
          !menu.contains(e.target) &&
          !host.contains(e.target)
        )
          close();
      },
      true,
    );
    menu.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        close(true);
      } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        const items = [...menu.querySelectorAll("button")],
          i = items.indexOf(document.activeElement),
          next =
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? items.length - 1
                : (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
                  items.length;
        items[next].focus();
      }
    });
    root.addEventListener("resize", () => close());
    for (const [kind, it, en, symbol] of listKinds) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.listStyle = kind;
      b.setAttribute("role", "menuitemradio");
      const glyph = document.createElement("span"),
        label = document.createElement("span");
      glyph.className = "nm-list-preview";
      glyph.setAttribute("aria-hidden", "true");
      glyph.textContent = symbol;
      b.append(glyph, label);
      const translate = () => {
        label.textContent = tr(it, en);
        b.setAttribute("aria-label", label.textContent);
      };
      translate();
      root.NeuroMapWorkspaceLocale?.watch(translate);
      b.addEventListener("click", () => {
        app.closeEditor(true);
        app.nm70BatchStyle(tr("Elenco", "List"), (node) => {
          node.text = formatList(node.text, kind);
        });
        close(true);
        sync();
      });
      menu.append(b);
    }
    const translate = () => {
      trigger.textContent = "☷ " + tr("Elenco", "List") + " ⌄";
      trigger.title = tr("Formato dell’elenco", "List format");
      menu.setAttribute("aria-label", tr("Elenchi", "Lists"));
    };
    translate();
    root.NeuroMapWorkspaceLocale?.watch(translate);
    function sync() {
      const nodes = app.nm70ScopeNodes();
      for (const b of menu.children) {
        const checked =
          nodes.length > 0 &&
          nodes.every(
            (n) =>
              root.NeuroMapCaption?.listKind(n.text) === b.dataset.listStyle ||
              formatList(n.text, b.dataset.listStyle) === n.text,
          );
        b.setAttribute("aria-pressed", String(checked));
        b.setAttribute("aria-checked", String(checked));
      }
      trigger.dataset.active = String(
        nodes.some((n) => root.NeuroMapCaption?.listKind(n.text) !== "none"),
      );
    }
    app._nmSyncLists = sync;
    sync();
  }
  function insertTool(button,it,en,path,hintIt=it,hintEn=en){
    if(!button)return;
    delete button.dataset.it;delete button.dataset.en;
    button.classList.add('nm-insert-tool');button.dataset.nmLineIcon='1';
    const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
    for(const [key,value] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))icon.setAttribute(key,value);
    const line=document.createElementNS(icon.namespaceURI,'path');line.setAttribute('d',path);icon.append(line);
    const label=document.createElement('span');label.className='nm-insert-tool-label';
    root.NeuroMapWorkspaceLocale?.bind(label,it,en);
    root.NeuroMapWorkspaceLocale?.bind(button,it,en,'aria-label');
    root.NeuroMapWorkspaceLocale?.bind(button,hintIt,hintEn,'title');
    button.replaceChildren(icon,label);return button;
  }
