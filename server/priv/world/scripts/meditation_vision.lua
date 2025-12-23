-- meditation_vision.lua
-- Handles meditation-triggered visions and insight gains

local M = {}

function M.on_meditate(player, room)
  -- First vision in meditation hall
  if room.key == "meditation_hall" and not player:has_flag("first_vision") then
    player:show_cutscene("first_vision")
    player:set_flag("first_vision", true)
    player:add_insight(1)
    player:message("You feel a moment of clarity. Insight +1")
    return true
  end

  -- Gain insight from meditating in new locations
  local meditation_key = "meditated_" .. room.key
  if not player:has_flag(meditation_key) then
    player:set_flag(meditation_key, true)
    if room:has_tag("sacred") then
      player:add_insight(1)
      player:message("Meditating in this sacred place brings understanding. Insight +1")
    end
  end

  return false
end

function M.on_enter_sacred_room(player, room)
  -- Show special descriptions for sacred locations
  if room:has_tag("offering_shrine") then
    player:message("You sense this is a place where offerings have power.")
  end
end

return M
