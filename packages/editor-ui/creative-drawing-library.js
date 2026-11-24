  function libraryDialog(app, hostDialog = null) {
    const d = hostDialog || dialog(
        app,
        "nm-library-dialog",
        "Libreria personale",
        "Personal library",
      ),
      selected = app.state.findImage(app.state.selectedImageId),
      name = field("nm-library-name", "Nome elemento", "Object name");
    name.input.maxLength = 80;
    name.input.value =
      selected?.graphic?.kind === "formula"
        ? tr("La mia formula", "My formula")
        : tr("Il mio disegno", "My drawing");
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    const grid = document.createElement("div");
    grid.className = "nm-library-grid";
    let entries = readLibrary();
    const persist = () => {
      try {
        localStorage.setItem(LIBRARY, JSON.stringify(entries));
        return true;
      } catch {
        status.textContent = tr(
          "Spazio esaurito: elimina alcuni elementi dalla libreria.",
          "Storage full: remove some library objects.",
        );
        return false;
      }
    };
    const render = () => {
      grid.replaceChildren();
      const insertedSources=new Set(app.state.images.map(image=>image.src));
      entries.forEach((entry, index) => {
        const article = document.createElement("article"),
          img = document.createElement("img");
        img.src = entry.image.src;
        img.alt = entry.name;
        const title = document.createElement("strong");
        title.textContent = entry.name;
        article.className="nm-library-personal-card";
        article.dataset.applied=String(insertedSources.has(entry.image.src));
        article.append(
          img,
          title,
          button("", "Inserisci", "Insert", () => {
            if (!d.valid()) return;
            const center = app.renderer.screenToWorld(
              innerWidth / 2,
              innerHeight / 2,
            );
            const im = app.state.addImageItem({
              ...entry.image,
              id: app.state.generateId("img"),
              mode: "free",
              attachedNodeId: null,
              worldPos: center,
            });
            app.selectImage(im.id);
            app.markChanged();
            // The library remains the active surface after inserting a copy.
            document.getElementById('image-controls')?.classList.add('hidden');
            status.textContent=tr('Aggiunto alla mappa','Added to map')+' · '+entry.name;
            render();grid.children[index]?.querySelector('button')?.focus({preventScroll:true});
          }),
          button("", "Elimina", "Delete", () => {
            const before = entries;
            entries = entries.filter((_, i) => i !== index);
            if (!persist()) entries = before;
            render();
          }),
        );
        appliedBadge(article,insertedSources.has(entry.image.src));
        grid.append(article);
      });
    };
    const save = button(
      "nm-library-save",
      "Salva elemento selezionato",
      "Save selected object",
      () => {
        if (
          !d.valid() ||
          !selected?.graphic ||
          !app.state.images.includes(selected)
        )
          return;
        if (entries.length >= 50) {
          status.textContent = tr(
            "La libreria contiene già 50 elementi.",
            "The library already contains 50 objects.",
          );
          return;
        }
        const before = entries;
        entries = [
          ...entries,
          {
            name: name.input.value.trim() || tr("Elemento", "Object"),
            image: app.state.constructor.cloneImages([selected])[0],
          },
        ];
        if (!persist()) entries = before;
        else status.textContent = tr("Elemento salvato.", "Object saved.");
        render();
      },
    );
    save.disabled = !selected?.graphic;
    (d.panel.closest('[role=dialog]')||d.panel)._nmOnExpand=()=>{if(d.valid())render();};
    d.panel.append(name.label, save, status, grid);
    render();
  }
