    // NeuroMap Desktop 5.2 — consistent multi-selection, accessible typography,
    // native file identity, optional layout HUD, protected desktop AI secret.
    const V6_PRESET_NAMES={uniform:'Uniforme',balanced:'Graduale',pyramid:'Piramide',branches:'Rami protagonisti',compact:'Compatto'};
    const V6_PREF_KEY='neuromap.typography.default.v6';
    function v6PreferredPreset(){try{const p=localStorage.getItem(V6_PREF_KEY);return V6_PRESET_NAMES[p]?p:'uniform';}catch(_){return 'uniform';}}
    const v6El=id=>document.getElementById(id);
    const v6Sleep=()=>new Promise(resolve=>requestAnimationFrame(resolve));
    const v6OriginalNewState=NeuroMapApp.prototype.newState;
    NeuroMapApp.prototype.newState=function(...args){const st=v6OriginalNewState.apply(this,args);st.typographyPreset=v6PreferredPreset();return st;};
    // All sheets opened from the same XMind document are saved together,
    // including the NeuroMap-only metadata for round-trip editing.
/* @neuromap-desktop-controls-native */
/* @neuromap-desktop-controls-selection */
/* @neuromap-desktop-controls-bind */
