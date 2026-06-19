const dialog = document.querySelector(".lightbox");
const dialogImage = dialog?.querySelector("img");

document.querySelectorAll("[data-image]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!dialog || !dialogImage) return;
    dialogImage.src = button.dataset.image;
    dialogImage.alt = button.dataset.alt || "Gym Tracker screenshot";
    dialog.showModal();
  });
});

dialog?.querySelector(".lightbox-close")?.addEventListener("click", () => dialog.close());
dialog?.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
