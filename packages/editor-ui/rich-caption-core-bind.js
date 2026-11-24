  function automaticListsEnabled(){
    if(automaticLists===undefined){try{automaticLists=globalThis.localStorage?.getItem(AUTO_LIST_KEY)==='true';}catch{automaticLists=false;}}
    return automaticLists===true;
  }
  function setAutomaticLists(value){
    automaticLists=value===true;
    try{globalThis.localStorage?.setItem(AUTO_LIST_KEY,String(automaticLists));}catch{}
    return automaticLists;
  }
  function bindListInput(input) {
    if (!input || input.dataset.nmAutoList) return;
    input.dataset.nmAutoList = "1";
    input.addEventListener(
      "keydown",
      (event) => {
        if (
          !automaticListsEnabled() || event.isComposing || event.keyCode===229 ||
          event.key !== "Enter" ||
          event.shiftKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey
        )
          return;
        const next = continueList(
          input.value,
          input.selectionStart,
          input.selectionEnd,
        );
        if (!next) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (
          input.maxLength > 0 &&
          input.value.length - (next.end - next.start) + next.insert.length >
            input.maxLength
        )
          return;
        input.setRangeText(next.insert, next.start, next.end, "end");
        input.setSelectionRange(next.caret, next.caret);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      },
      true,
    );
  }
