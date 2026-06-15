// AbyssForge v2 - ML.Character: player locomotion & state.
// The scene owns input plumbing (keyboard, physical-key queue, mobile taps) and
// every downstream system (energy, survival regen, observer awareness). This
// module owns ONE job: turn a frame's directional intent into body velocity plus
// jump / ladder / lava state, then hand that state back so the scene can drive
// the rest.
//
//   ML.Character.update(scene, input, dt) -> { vx, onFloor, onLadder, inLava, sprinting }
//
// input = { left, right, up, down, jumpPressed } already resolved from keyboard,
// physical keys, and mobile taps by the scene. Helpers it leans on (touchingLava,
// trackFall, updatePlayerAnim, emitDust) stay on the scene — same delegation
// pattern as ML.MobAI calling back into the scene for world effects.
(() => {
  "use strict";
  const ML = window.ML;

  function update(scene, input, _dt) {
    const player = scene.player;
    const sim = scene.sim;
    const TILE = ML.TILE;
    const Tile = ML.Tile;
    const physical = scene.physicalKeys || {};

    const tileX = Math.floor(player.x / TILE);
    const tileY = Math.floor(player.y / TILE);
    const standingTile = sim.tileAt(tileX, tileY);
    const onLadder = standingTile === Tile.LADDER || sim.tileAt(tileX, tileY + 1) === Tile.LADDER;
    const onFloor = player.body.blocked.down || player.body.onFloor();
    const inLava = scene.touchingLava();

    scene.platformDrop = input.down && !onLadder;

    const sprinting = (scene.keys.sprint.isDown || physical.sprint) && sim.energy > 6 && onFloor && !onLadder;
    let speed = sprinting ? 305 : 220;
    if (sim.speedBoost) speed *= sprinting ? 1.18 : 1.12;
    if (inLava) speed *= 0.5;
    let vx = 0;
    if (input.left) vx -= speed;
    if (input.right) vx += speed;
    player.setVelocityX(vx);
    player.setFlipX(vx < 0 ? true : vx > 0 ? false : player.flipX);

    if (onLadder) {
      player.body.allowGravity = false;
      scene.jumpsUsed = 0;
      scene.wasAirborne = false;
      scene.peakFallVy = 0;
      if (input.up) {
        player.setVelocityY(-170);
      } else if (input.down) {
        player.setVelocityY(170);
      } else {
        player.setVelocityY(0);
      }
      if (input.jumpPressed && (input.left || input.right)) {
        player.body.allowGravity = true;
        player.setVelocityY(-335);
        ML.audio.play("jump");
      }
    } else {
      player.body.allowGravity = true;
      if (onFloor) scene.jumpsUsed = 0;
      if (input.jumpPressed) {
        // Base kit is a double jump (1 ground + 1 air). Cave boots upgrade it to
        // a triple jump (1 ground + 2 air); boots also soften landings + cut fall
        // damage (see scene.trackFall).
        const maxJumps = sim.boots ? 3 : 2;
        if (onFloor) {
          player.setVelocityY(inLava ? -300 : -455);
          scene.jumpsUsed = 1;
          ML.audio.play("jump");
        } else if (scene.jumpsUsed < maxJumps) {
          // Walked off a ledge without using the ground jump? Consume it so a
          // free fall still yields exactly one air jump at base (two with boots).
          if (scene.jumpsUsed === 0) scene.jumpsUsed = 1;
          player.setVelocityY(-400);
          scene.jumpsUsed += 1;
          scene.peakFallVy = 0; // air jump arrests the fall — no phantom landing damage
          ML.audio.play("doubleJump");
          scene.emitDust(player.x, player.y + 14, 4);
        }
      }
    }

    scene.trackFall(onFloor, onLadder);
    scene.updatePlayerAnim(vx, onFloor, onLadder);

    return { vx, onFloor, onLadder, inLava, sprinting };
  }

  ML.Character = { update };
})();
