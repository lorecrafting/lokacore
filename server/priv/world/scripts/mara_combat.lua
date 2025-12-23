-- mara_combat.lua
-- Special combat mechanics for Mara bosses

local M = {}

-- Raga Mara: Gets stronger when player uses items
function M.raga_on_item_use(player, item, raga)
  if raga.key ~= "raga_mara" then return end

  raga.attack_bonus = (raga.attack_bonus or 0) + 2
  player:message("Raga Mara grows stronger from your desire!")
  raga:say("Yes! Want more! Use more!")
end

-- Dvesha Mara: Reflects damage when attacked recklessly
function M.dvesha_on_damage(attacker, dvesha, damage, attack_type)
  if dvesha.key ~= "dvesha_mara" then return damage end

  -- Reckless attacks (not defend stance) get reflected
  if attack_type == "attack" and not attacker:has_status("patient_stance") then
    local reflected = math.floor(damage * 0.25)
    attacker:take_damage(reflected)
    attacker:message("Your hasty attack is reflected! " .. reflected .. " damage to you!")
    return damage
  end

  -- Patient attacks do bonus damage
  if attacker:has_status("patient_stance") then
    local bonus = math.floor(damage * 0.5)
    attacker:message("Your patience pierces Dvesha's guard! +" .. bonus .. " damage!")
    return damage + bonus
  end

  return damage
end

-- Moha Mara: Creates illusion copies
function M.moha_on_combat_start(player, moha)
  if moha.key ~= "moha_mara" then return end

  -- Create 4 illusion copies
  for i = 1, 4 do
    local copy = moha:create_illusion()
    copy.name = "Moha Mara"
    copy.is_real = false
  end

  player:message("Moha Mara splits into multiple forms!")
end

function M.moha_on_damage(attacker, target, damage)
  if not target.is_moha_copy then return damage end

  -- Illusions take no damage unless revealed
  if not attacker:has_status("clarity") then
    attacker:message("Your attack passes through an illusion!")
    return 0
  end

  return damage
end

-- Final Mara: Insight weakens it
function M.mara_deceiver_on_damage(attacker, mara, damage)
  if mara.key ~= "mara_the_deceiver" then return damage end

  local insight = attacker:get_insight()
  local weakness = insight * 10  -- 10% per insight point

  -- Apply insight bonus
  local bonus = math.floor(damage * weakness / 100)
  if bonus > 0 then
    attacker:message("Your insight pierces Mara's illusions! +" .. bonus .. " damage!")
  end

  return damage + bonus
end

function M.mara_deceiver_on_defeat(player, mara)
  -- Cannot be killed by violence alone under certain insight thresholds
  if mara.health <= 0 then
    player:show_cutscene("final_choice")
  end
end

return M
