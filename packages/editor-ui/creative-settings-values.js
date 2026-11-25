  function stateValues(state, spec) {
    const source = rootSpec(spec) ? state.root : state;
    return clean(
      Object.fromEntries(
        spec.fields.map((key) => [
          key,
          source[key] ??
            {
              activeThemeId: "default",
              layoutMode: "balanced",
              rootBranchGap: 14,
              balanceBias: state.thresholdY ?? 50,
              branchGapX: 150,
              compactness: 100,
              layoutDistribution: {
                enabled: false,
                height: 960,
                minimumHeight: 480,
              },
            }[key],
        ]),
      ),
      spec.fields,
    );
  }
  function targetNodes(state, mode) {
    const all = [];
    const walk = (node, depth, selected) => {
      const pending=[{node,depth}],seen=new WeakSet();
      while(pending.length){const frame=pending.pop(),current=frame.node;if(!current||seen.has(current))continue;seen.add(current);
        if(selected(current,frame.depth))all.push(current);
        for(let i=(current.children?.length||0)-1;i>=0;i--)pending.push({node:current.children[i],depth:frame.depth+1});
      }
    };
    if (mode === "map" || mode.startsWith("level"))
      walk(
        state.root,
        0,
        (_, depth) => mode === "map" || depth === Number(mode.slice(5)),
      );
    else {
      const ids=state.selectedNodeIds?.length?state.selectedNodeIds:[state.selectedNodeId];
      const picked=root.NeuroMapCore.findNodesById(state.root,new Set(ids)).filter(Boolean);
      if(mode === "selection") all.push(...picked);
      else for (const node of picked)
        walk(node, 0, (_, depth) => mode === "subtree" || depth > 0);
    }
    return [...new Set(all)];
  }
  function nodeValues(node, spec) {
    return clean(
      Object.fromEntries(
        spec.fields.map((key) => [
          key,
          node[key] ??
            {
              fontSize: null,
              fontWeight: 400,
              fontItalic: false,
              fontUnderline:false,
              fontStrike:false,
              fontFamily:null,
              fontColor:null,
              nodeShape: "plain",
              labelWrapChars: null,
              labelIndent: 0,
              labelAlign: "center",
            }[key],
        ]),
      ),
      spec.fields,
    );
  }
  // Read-only summary: once a different sanitized value is found, later values
  // cannot change the result. Never retain targets beyond the caller's refresh.
  function summarizeSettings(spec, states, resolveNodes) {
    let value = {}, empty = true, signature;
    for (const state of states) {
      const targets = spec.kind === "node" ? resolveNodes(state) : [state];
      for (const target of targets) {
        const sample = spec.kind === "node" ? nodeValues(target, spec) : stateValues(target, spec);
        const next = JSON.stringify(sample);
        if (empty) {
          value = sample;
          signature = next;
          empty = false;
        } else if (next !== signature) return { value, mixed: true, empty: false };
      }
    }
    return { value, mixed: false, empty };
  }
  function layoutMode(app, state, mode) {
    if(mode==='balanced')state.root.layoutBalanceMode='geometry';
    if (state.branchStyle === "radial") state.branchStyle = "xmind8";
    if (mode === "clockwise" && !state.root.layoutDistribution?.enabled) {
      const priorSettings=state.root.layoutDistribution;
      if(priorSettings?.overflowMode==='expand'){
        state.root.layoutDistribution={...priorSettings,enabled:true};
        state.root.layoutMode=mode;
        return;
      }
      if (["right", "left"].includes(state.root.layoutMode)) {
        state.balanceBias = state.thresholdY = 50;
        state.root.layoutMode = "balanced";
      }
      const layout = new app.layout.constructor();
      for (const key of [
        "typographyPreset",
        "typographyScale",
        "defaultLabelWrapChars",
        "branchStyle",
        "compactness",
        "branchGapX",
      ])
        layout[key] = state[key];
      layout.balanceBias = layout._nmBias =
        state.balanceBias ?? state.thresholdY ?? 50;
      layout._nmImages = state.images;
      const metrics = layout.computeLayout(state.root, layout.balanceBias);
      state.root.layoutDistribution = root.NeuroMapContinuation.initialSettings(
        { state, splitMetrics: metrics },
      );
    } else if (mode !== "clockwise")
      state.root.layoutDistribution = {
        ...(state.root.layoutDistribution || {}),
        enabled: false,
      };
    state.root.layoutMode = mode;
  }
