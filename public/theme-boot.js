// Roda antes da primeira pintura: aplica o tema salvo (escuro, claro ou sistema) para a página não piscar.
(function () {
  try {
    var p = localStorage.getItem("lamina-theme");
    if (p !== "light" && p !== "system") p = "dark";
    var t = p === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : p;
    var d = document.documentElement;
    d.setAttribute("data-theme", t);
    d.style.colorScheme = t;
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", t === "light" ? "#f7f5fb" : "#0c0b10");
  } catch (e) {}
})();
