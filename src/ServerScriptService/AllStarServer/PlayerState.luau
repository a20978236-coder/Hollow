--[[
	All-Star :: PlayerState (server ModuleScript)

	Authoritative per-player ability state. Lives only on the server; clients
	never see or write it. Attributes on the character (Flying / Charging) are a
	one-way MIRROR of this state for client VFX, never the source of truth.
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("AllStar")
local CooldownTracker = require(Shared:WaitForChild("CooldownTracker"))

export type State = {
	cooldowns: CooldownTracker.CooldownTracker,
	flying: boolean,
	strikes: number,
	charging: boolean,
	chargeStart: number,
	chargeToken: number,
	activeBlasts: number,
	peakDownSpeed: number, -- largest downward speed seen recently (studs/s)
	peakDownAt: number, -- os.clock() of that sample
}

local PlayerState = {}

local states: { [Player]: State } = {}

function PlayerState.add(player: Player): State
	local state: State = {
		cooldowns = CooldownTracker.new(),
		flying = false,
		strikes = 0,
		charging = false,
		chargeStart = 0,
		chargeToken = 0,
		activeBlasts = 0,
		peakDownSpeed = 0,
		peakDownAt = 0,
	}
	states[player] = state
	return state
end

function PlayerState.get(player: Player): State?
	return states[player]
end

function PlayerState.remove(player: Player)
	states[player] = nil
end

-- Called on every (re)spawn. Cooldowns intentionally persist across deaths.
function PlayerState.resetForCharacter(state: State)
	state.flying = false
	state.strikes = 0
	state.charging = false
	state.chargeStart = 0
	state.chargeToken += 1
	state.peakDownSpeed = 0
	state.peakDownAt = 0
end

function PlayerState.all(): { [Player]: State }
	return states
end

return PlayerState
