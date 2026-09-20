import "./fallback.css";
import "./reader.css";
import "./library.css";
import "./reader";
import "./library";

function startConfiguredViewer(): void {
  const library = document.querySelector<HTMLElement>('[data-yar-start="library"]');
  if (library) {
    window.ComicLibrary.start({
      root: library.getAttribute("data-yar-root") || "./",
      mount: library.id || "library",
      label: library.getAttribute("data-yar-label") || "YarReader",
    });
    return;
  }

  const reader = document.querySelector<HTMLElement>('[data-yar-start="reader"]');
  const itemPath = reader?.getAttribute("data-yar-path");
  if (reader && itemPath) {
    window.ComicReader.start({
      path: itemPath,
      root: reader.getAttribute("data-yar-root") || "../../../",
      mount: reader.id || "reader",
    });
  }
}

startConfiguredViewer();
