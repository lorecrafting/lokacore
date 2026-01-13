-- hooks.lua
-- Register all game hooks for the demo

local meditation = require("meditation_vision")
local combat = require("mara_combat")

local M = {}

-- Room entry hooks
function M.at_enter_room(player, room)
  -- Sacred room effects
  meditation.on_enter_sacred_room(player, room)

  -- Chamber entry cutscenes handled by cutscene system
end

-- Meditation hooks
function M.at_meditate(player, room)
  return meditation.on_meditate(player, room)
end

-- Combat hooks
function M.at_combat_start(player, enemy)
  if enemy.key == "moha_mara" then
    combat.moha_on_combat_start(player, enemy)
  end
end

function M.at_damage(attacker, target, damage, attack_type)
  -- Boss-specific damage modifications
  if target.key == "dvesha_mara" then
    return combat.dvesha_on_damage(attacker, target, damage, attack_type)
  end

  if target.key == "mara_the_deceiver" then
    return combat.mara_deceiver_on_damage(attacker, target, damage)
  end

  if target.is_moha_copy then
    return combat.moha_on_damage(attacker, target, damage)
  end

  return damage
end

function M.at_item_use(player, item, target)
  -- Raga gets stronger when player uses items during fight
  if player.in_combat and player.combat_target then
    combat.raga_on_item_use(player, item, player.combat_target)
  end
end

function M.at_enemy_defeat(player, enemy)
  if enemy.key == "mara_the_deceiver" then
    combat.mara_deceiver_on_defeat(player, enemy)
  end
end

-- Death and respawn
function M.at_player_death(player)
  -- Show bardo vision
  player:show_cutscene("bardo_vision")

  -- Respawn at last meditation point
  local respawn = player:get_flag("last_meditation_point") or "monastery_gate"
  player:teleport(respawn)
  player:restore_health(player.max_health * 0.5)

  player:message("You awaken, as if from a dream within a dream...")
end

return M
