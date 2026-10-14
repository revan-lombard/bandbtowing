/*
 * Gallery photos.
 * To add a photo: put the file in assets/img/gallery/ and add a line below, e.g.
 *   { src: "assets/img/gallery/bakkie-recovery.jpg", caption: "Bakkie recovery, Midrand" },
 * Leave the list empty to show "coming soon" placeholders.
 */
var GALLERY_PHOTOS = [
  // { src: "assets/img/gallery/example.jpg", caption: "Describe the job" },
];

(function () {
  var grid = document.getElementById("gallery-grid");
  if (!grid) return;

  var cameraIcon =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';

  if (!GALLERY_PHOTOS.length) {
    for (var i = 0; i < 6; i++) {
      var ph = document.createElement("figure");
      ph.className = "gallery-item";
      ph.innerHTML = '<div class="gallery-placeholder"><div>' + cameraIcon + "Photos coming soon</div></div>";
      grid.appendChild(ph);
    }
    return;
  }

  var dialog = document.getElementById("lightbox");
  var dImg = dialog.querySelector("img");
  var dCap = dialog.querySelector("p");

  GALLERY_PHOTOS.forEach(function (photo) {
    var fig = document.createElement("figure");
    fig.className = "gallery-item";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-label", "View larger: " + (photo.caption || "photo"));
    var img = document.createElement("img");
    img.src = photo.src;
    img.alt = photo.caption || "B&B Towing job";
    img.loading = "lazy";
    btn.appendChild(img);
    fig.appendChild(btn);
    if (photo.caption) {
      var cap = document.createElement("figcaption");
      cap.textContent = photo.caption;
      fig.appendChild(cap);
    }
    btn.addEventListener("click", function () {
      dImg.src = photo.src;
      dImg.alt = img.alt;
      dCap.textContent = photo.caption || "";
      if (dialog.showModal) dialog.showModal();
      else window.open(photo.src, "_blank");
    });
    grid.appendChild(fig);
  });

  dialog.querySelector(".lightbox-close").addEventListener("click", function () { dialog.close(); });
  dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
})();
