// Placeholder runtime — replaced by the Three.js scene + sun/weather wiring
// in later phases. For now it only proves the dev/build pipeline works end
// to end (canvas present, dynamic import resolves, dark backdrop renders).

export function startApp(): void {
  const canvas = document.querySelector<HTMLCanvasElement>("#scene");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  function resize(): void {
    canvas!.width = window.innerWidth;
    canvas!.height = window.innerHeight;
    draw();
  }

  function draw(): void {
    ctx!.fillStyle = "#03040a";
    ctx!.fillRect(0, 0, canvas!.width, canvas!.height);
    ctx!.fillStyle = "#5a6b8c";
    ctx!.font = "16px system-ui, sans-serif";
    ctx!.textAlign = "center";
    ctx!.fillText("Lumen Bloom — scene coming soon", canvas!.width / 2, canvas!.height / 2);
  }

  window.addEventListener("resize", resize);
  resize();
}
