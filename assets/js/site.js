/* Shared behaviour for every page: mobile menu, contact links, footer year. */
(function () {
  var cfg = window.BB_CONFIG || {};

  // Mobile navigation toggle
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  // Contact links come from config.js so the number only lives in one place
  document.querySelectorAll("[data-tel]").forEach(function (a) {
    a.href = "tel:" + cfg.phoneNumber;
  });
  document.querySelectorAll("[data-wa]").forEach(function (a) {
    var text = a.getAttribute("data-wa");
    a.href = "https://wa.me/" + cfg.whatsappNumber + (text ? "?text=" + encodeURIComponent(text) : "");
  });
  document.querySelectorAll("[data-phone-display]").forEach(function (el) {
    el.textContent = cfg.phoneDisplay;
  });

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
