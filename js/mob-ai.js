// AbyssForge v2 - ML.MobAI: mob / NPC behaviour.
// Two layers, both driven by the scene (which owns the world queries + effects):
//   decide(scene, enemy, now) -> sense the world and pick an intent {mode,...}
//   act(scene, enemy, intent, now) -> steer the body for this enemy kind
// Spawning/activation/materialisation stays in the scene; this module is the
// brain (what to do) and the motor (how to move), not the spawner.
(() => {
  "use strict";
  const ML = window.ML;

  function decide(scene, enemy, now = scene.time.now) {
    const ENEMIES = ML.ENEMIES;
    if (enemy.nextThinkAt && now < enemy.nextThinkAt && enemy.intent) return enemy.intent;
    const sensor = ML.MobSensors?.sense?.(scene, enemy, now) || null;
    const cfg = sensor?.cfg || ENEMIES[enemy.kind] || {};
    const ai = cfg.ai || {};
    const dx = sensor?.dx ?? (scene.player.x - enemy.x);
    const dy = sensor?.dy ?? (scene.player.y - enemy.y);
    const distance = sensor?.targetDistance ?? Math.max(1, Math.hypot(dx, dy));
    const playerDistance = sensor?.playerDistance ?? Math.max(1, Math.hypot(scene.player.x - enemy.x, scene.player.y - enemy.y));
    const dir = sensor?.dir ?? (Math.sign(dx) || 1);
    const localLight = sensor?.localLight ?? scene.lightLevelAt(enemy.x, enemy.y);
    const hpRatio = ML.clamp((enemy.hp || 1) / Math.max(1, enemy.maxHp || 1), 0, 1);
    const playerWeak = (scene.sim.health / Math.max(1, scene.sim.maxHealth) < 0.34)
      || (scene.sim.energy / Math.max(1, scene.sim.maxEnergy) < 0.24)
      || (scene.shadowPressure || 0) > 58;
    const observed = scene.isEnemyObserved(enemy);
    const poiAnchor = !cfg.boss && !enemy.elite ? scene.discoveryAnchorForEnemy(enemy, now) : null;
    const poiCurious = Boolean(poiAnchor
      && !sensor?.canSeePlayer
      && !sensor?.heardNoise
      && !sensor?.hasMemory
      && ["guardian", "stalker", "ambusher", "harrier"].includes(ai.mind));
    const aware = Boolean(sensor?.canSeePlayer || sensor?.heardNoise || sensor?.hasMemory || cfg.boss || enemy.elite);
    let allies = 0;
    for (const other of scene.enemies.getChildren()) {
      if (!other.active || other === enemy || other.kind !== enemy.kind) continue;
      if (Phaser.Math.Distance.Between(other.x, other.y, enemy.x, enemy.y) < 150) allies += 1;
    }

    let mode = aware ? "press" : "wait";
    if (!aware) {
      if (poiCurious) mode = ai.mind === "guardian" ? "guard" : ai.mind === "ambusher" ? "wait" : "stalk";
      else mode = ai.mind === "guardian" ? "guard" : "wait";
    } else if (!sensor?.canSeePlayer && sensor?.heardNoise) {
      mode = ai.mind === "ambusher" ? "wait" : "stalk";
    } else if (!sensor?.canSeePlayer && sensor?.hasMemory) {
      mode = "stalk";
    } else if (cfg.boss) {
      mode = playerDistance > 260 ? "guard" : playerWeak ? "pressure" : "press";
    } else if (observed && !playerWeak && playerDistance > 82 && playerDistance < 360 && ["stalker", "ambusher", "guardian", "harrier"].includes(ai.mind)) {
      mode = "watch";
    } else if (hpRatio < 0.38 && (ai.courage || 0.5) < 0.75 && localLight > 0.34) {
      mode = "retreat";
    } else if (localLight > (0.48 + (ai.courage || 0.5) * 0.22) && (ai.lightFear || 0) > 0.28) {
      mode = "circle";
    } else if (ai.mind === "ambusher" && playerDistance > 125 && !playerWeak) {
      mode = "wait";
    } else if (ai.mind === "guardian" && playerDistance > 230) {
      mode = "guard";
    } else if (playerWeak || allies >= 2 || enemy.elite || enemy.event) {
      mode = "pressure";
    } else if (ai.mind === "stalker" && playerDistance > 170) {
      mode = "stalk";
    } else if (ai.mind === "skittish" && (playerDistance < 78 || localLight > 0.52)) {
      mode = "retreat";
    }

    const speedMult = mode === "pressure" ? 1.22
      : mode === "stalk" ? 0.72
        : mode === "circle" ? 0.88
          : mode === "guard" ? 0.5
            : mode === "wait" ? 0.25
              : mode === "watch" ? 0
                : mode === "retreat" ? 1.05
                  : 1;
    const targetX = poiCurious ? poiAnchor.x : sensor?.targetX ?? scene.player.x;
    const targetY = poiCurious ? poiAnchor.y : sensor?.targetY ?? scene.player.y;
    const moveDx = poiCurious ? targetX - enemy.x : dx;
    const moveDy = poiCurious ? targetY - enemy.y : dy;
    const moveDistance = poiCurious ? Math.max(1, Math.hypot(moveDx, moveDy)) : distance;
    const moveDir = Math.sign(moveDx) || dir;
    enemy.intent = {
      mode,
      dx: moveDx,
      dy: moveDy,
      dir: moveDir,
      distance: moveDistance,
      playerDistance,
      localLight,
      hpRatio,
      playerWeak,
      allies,
      observed,
      speedMult,
      sensorReason: sensor?.reason || "direct",
      canSeePlayer: Boolean(sensor?.canSeePlayer),
      heardNoise: Boolean(sensor?.heardNoise),
      poiCurious,
      targetX,
      targetY
    };
    enemy.nextThinkAt = now + Phaser.Math.Between(240, 420);
    if (enemy.lastIntentMode !== mode && now > (enemy.intentToastAt || 0)) {
      enemy.intentToastAt = now + 4200;
      enemy.lastIntentMode = mode;
      if (mode === "stalk" && sensor?.heardNoise && playerDistance < 320) scene.floatText(enemy.x - 18, enemy.y - 24, "HEARS", "#d8b6ff");
      if (poiCurious && playerDistance < 360) scene.floatText(enemy.x - 20, enemy.y - 25, mode === "guard" ? "GUARDS" : "STUDIES", "#9efff0");
      if (mode === "pressure" && playerDistance < 260) scene.floatText(enemy.x - 18, enemy.y - 26, "HUNTS", "#f0c75e");
      if (mode === "retreat" && playerDistance < 220) scene.floatText(enemy.x - 16, enemy.y - 24, "FLEES", "#9efff0");
      if (mode === "watch") {
        scene.floatText(enemy.x - 24, enemy.y - 28, "SEES", "#d8b6ff");
        scene.triggerObserverMoment("mobStare", { enemy });
      }
    }
    return enemy.intent;
  }

  function act(scene, enemy, intent, now = scene.time.now) {
    const ENEMIES = ML.ENEMIES;
    const dir = intent.mode === "retreat" ? -intent.dir : intent.dir;
    const speed = enemy.speed * (Number.isFinite(intent.speedMult) ? intent.speedMult : 1);

    if (intent.mode === "watch") {
      enemy.setVelocityX(0);
      if (ENEMIES[enemy.kind]?.fly) enemy.setVelocityY(Math.sin(now / 180 + enemy.bobSeed) * 24);
      enemy.setFlipX(intent.dx < 0);
      return;
    }
    if (intent.mode === "wait" && !ENEMIES[enemy.kind]?.boss) {
      enemy.setVelocityX(0);
      if (ENEMIES[enemy.kind]?.fly) enemy.setVelocityY(Math.sin(now / 180 + enemy.bobSeed) * 18);
      enemy.setFlipX((intent.targetX ?? scene.player.x) < enemy.x);
      return;
    }

    switch (enemy.kind) {
      case "bat": {
        const orbit = intent.mode === "circle" ? Math.sin(now / 260 + enemy.bobSeed) * 90 : 0;
        const targetX = intent.targetX ?? scene.player.x;
        const targetY = intent.targetY ?? scene.player.y;
        const dx = intent.mode === "retreat" ? -intent.dx + orbit : targetX + orbit - enemy.x;
        const dy = intent.mode === "retreat" ? -intent.dy - 28 : targetY - 6 - enemy.y;
        const dist = Math.max(20, Math.hypot(dx, dy));
        enemy.setVelocityX((dx / dist) * speed);
        enemy.setVelocityY((dy / dist) * speed * 0.8 + Math.sin(now / 170 + enemy.bobSeed) * 46);
        enemy.setFlipX(dx < 0);
        break;
      }
      case "slime": {
        if (enemy.body.blocked.down) {
          enemy.setVelocityX(enemy.body.velocity.x * 0.8);
          if (intent.mode !== "wait" && now > enemy.nextHopAt) {
            enemy.nextHopAt = now + (intent.mode === "pressure" ? 620 : 900) + Math.random() * 700;
            enemy.setVelocityX(dir * (intent.mode === "retreat" ? 145 : 175));
            enemy.setVelocityY(intent.mode === "pressure" ? -390 : -365);
          }
        }
        break;
      }
      case "broodmother": {
        enemy.setFlipX(dir < 0);
        if (enemy.body.blocked.down) {
          enemy.setVelocityX(enemy.body.velocity.x * 0.72);
          if (now > enemy.nextHopAt) {
            enemy.nextHopAt = now + (intent.playerWeak ? 560 : 760) + Math.random() * 520;
            enemy.setVelocityX(dir * (intent.mode === "retreat" ? 190 : 265));
            enemy.setVelocityY(-430);
          }
        }
        if (now > enemy.nextSpecialAt) {
          enemy.nextSpecialAt = now + (intent.playerWeak ? 3600 : 5200) + Math.random() * 2600;
          scene.summonMinion(enemy, Math.random() < 0.55 ? "crawler" : "slime");
        }
        break;
      }
      case "warden": {
        enemy.setVelocityX(dir * speed);
        enemy.setFlipX(dir < 0);
        if (enemy.body.blocked.down && (enemy.body.blocked.left || enemy.body.blocked.right) && Math.random() < 0.04) {
          enemy.setVelocityY(-315);
        }
        if (now > enemy.nextSpecialAt) {
          enemy.nextSpecialAt = now + (intent.playerWeak ? 1900 : 2600) + Math.random() * 1600;
          scene.bossShockwave(enemy);
        }
        break;
      }
      case "golem": {
        enemy.setVelocityX(dir * speed);
        enemy.setFlipX(dir < 0);
        if (enemy.body.blocked.down && (enemy.body.blocked.left || enemy.body.blocked.right) && Math.random() < 0.03) {
          enemy.setVelocityY(-300);
        }
        break;
      }
      default: { // crawler
        enemy.setVelocityX(dir * speed);
        enemy.setFlipX(dir < 0);
        if (enemy.body.blocked.down && intent.mode !== "wait" && ((scene.player.y < enemy.y - 40 && Math.random() < (intent.mode === "pressure" ? 0.028 : 0.012)) || ((enemy.body.blocked.left || enemy.body.blocked.right) && Math.random() < 0.06))) {
          enemy.setVelocityY(intent.mode === "pressure" ? -360 : -330);
        }
      }
    }
  }

  ML.MobAI = { decide, act };
})();
