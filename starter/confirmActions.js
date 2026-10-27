/*
 * confirmActions.js — ask "Are you sure?" before a destructive action.
 *
 * Usage: add a data-confirm attribute to any <form> or <a>:
 *
 *   <form method="post" data-confirm="Delete this note?"> ... </form>
 *   <a href="..." data-confirm="Leave without saving?">Cancel</a>
 *
 * If the user clicks "Cancel" in the dialog, the submit or click is stopped.
 *
 * How it works: one listener on the whole document catches every submit and
 * click (this is called "event delegation"). Listening in the capture phase
 * (the `true` argument) means it runs before any other handler, including
 * Blazor's, so it also works for content Blazor adds or replaces later.
 */
(function () {
    function confirmOrCancel(event, element) {
        if (element && !window.confirm(element.dataset.confirm)) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }

    document.addEventListener("submit", function (event) {
        confirmOrCancel(event, event.target.closest("form[data-confirm]"));
    }, true);

    document.addEventListener("click", function (event) {
        confirmOrCancel(event, event.target.closest("a[data-confirm]"));
    }, true);
})();
