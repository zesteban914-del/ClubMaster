function delegateAction(root, handlers) {
  (root || document).addEventListener('click', function(e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
    if (!el || (root && root !== document && !root.contains(el))) return;
    var fn = handlers[el.getAttribute('data-action')];
    if (typeof fn === 'function') { e.preventDefault(); fn(el, e); }
  });
}
if (typeof window !== 'undefined') window.delegateAction = delegateAction;
