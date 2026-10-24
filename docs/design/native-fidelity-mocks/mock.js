// Mock-only: ?theme=dark paints the dark palette; the dock lens sits under the tab named by data-tab on <body>.
document.documentElement.dataset.theme = new URLSearchParams(location.search).get("theme") || "light";
addEventListener("DOMContentLoaded", () => {
  const dock = document.querySelector(".dock"); if (!dock) return;
  const i = ["today", "progress", "history", "program"].indexOf(document.body.dataset.tab);
  const b = dock.querySelectorAll("button")[i], lens = dock.querySelector(".dock__lens");
  if (b) { b.setAttribute("aria-current", "page"); lens.style.left = b.offsetLeft + "px"; lens.style.width = b.offsetWidth + "px"; }
});
