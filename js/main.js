// AbyssForge v2 - boot.
(() => {
  "use strict";
  const ML = window.ML;

  const config = {
    type: Phaser.AUTO,
    parent: "game",
    backgroundColor: "#191813",
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: window.innerWidth,
      height: window.innerHeight
    },
    physics: {
      default: "arcade",
      arcade: {
        gravity: { y: 1180 },
        debug: false
      }
    },
    scene: [ML.MineScene]
  };

  window.addEventListener("error", (event) => {
    if (ML.showToast) ML.showToast(`Runtime error: ${event.message}`, 6000);
  });

  new Phaser.Game(config);
})();
