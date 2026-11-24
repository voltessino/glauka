    /* Open Source edition: hide AI Studio triggers cleanly without AI runtime. */
    NeuroMapApp.prototype.openAIStudio = function () {
      this.showToast?.('AI Studio is available in Glauka Pro (https://glauka.it).', 'Glauka Open');
    };
    NeuroMapApp.prototype.openAISettings = function () { this.openAIStudio(); };
    if (typeof document !== 'undefined') {
      const hideOpenAiButtons = () => {
        for (const id of ['btn-ai-settings', 'btn-ai-expand', 'btn-ai-explain', 'nm6-plan-button', 'ai-explain-panel', 'ai-settings-modal']) {
          const el = document.getElementById(id);
          if (el) { el.hidden = true; el.style.display = 'none'; }
        }
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hideOpenAiButtons);
      else hideOpenAiButtons();
    }
