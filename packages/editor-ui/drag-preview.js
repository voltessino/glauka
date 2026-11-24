/* One drop decision, one prospective layout, and one commit for every editor. */
(function(root){'use strict';
 const validKinds=new Set(['child','reorder','detach','place']);
/* @neuromap-drag-preview-resolve */
/* @neuromap-drag-preview-apply */
/* @neuromap-drag-preview-preview */
 root.NeuroMapDrag={resolve,apply,applyGroup,rootsFor,dragIds,dragAnchor,preview,clear,install};
})(typeof globalThis==='object'?globalThis:this);
