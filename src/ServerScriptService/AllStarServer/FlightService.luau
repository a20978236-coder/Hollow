--[[
	All-Star :: FlightService (server ModuleScript)

	Server owns the flight STATE (on/off, cooldown). The client owns the
	character's physics (Roblox gives each player network ownership of their
	character), so the client drives the actual movement for responsive
	controls, and the server polices it:

	  * flight only toggles through a validated, cooldown-gated request
	  * velocity is sampled every Config.Security.MonitorInterval seconds;
	    sustained speeds above the legit maximum add strikes and eventually
	    force flight off with a longer cooldown
	  * the same sampler records recent downward speed for landing validation
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Shared = ReplicatedStorage:WaitForChild("AllStar")
local Config = require(Shared:WaitForChild("Config"))
local Validation = require(Shared:WaitForChild("Validation"))

local PlayerState = require(script.Parent:WaitForChild("PlayerState"))
local ServerNet = require(script.Parent:WaitForChild("ServerNet"))

local FlightService = {}

local FLIGHT = Config.Flight
local ATTR = Config.Attributes

function FlightService.setFlying(_player: Player, state: PlayerState.State, character: Model, on: boolean)
	state.flying = on
	state.strikes = 0
	character:SetAttribute(ATTR.Flying, on)
end

-- Remote handler: payload = desired state (boolean).
function FlightService.handleToggle(player: Player, state: PlayerState.State, character: Model, payload: any)
	if not Validation.isBoolean(payload) then
		return
	end
	local wanted = payload :: boolean
	if wanted == state.flying then
		return -- already in that state; nothing to do
	end
	if not state.cooldowns:IsReady("FlightToggle") then
		ServerNet.deny(player, Config.Actions.ToggleFlight, "cooldown")
		return
	end
	FlightService.setFlying(player, state, character, wanted)
	state.cooldowns:Start("FlightToggle", Config.Cooldowns.FlightToggle)
	ServerNet.cooldown(player, "FlightToggle", Config.Cooldowns.FlightToggle)
end

function FlightService.forceStop(player: Player, state: PlayerState.State, cooldown: number?)
	local character = player.Character
	if state.flying and character then
		FlightService.setFlying(player, state, character, false)
	end
	if cooldown then
		state.cooldowns:Start("FlightToggle", cooldown)
		ServerNet.cooldown(player, "FlightToggle", cooldown)
	end
end

local function sample(player: Player, state: PlayerState.State, now: number)
	local character, _, root = Validation.getAliveCharacter(player)
	if not character or not root then
		return
	end
	local velocity = root.AssemblyLinearVelocity

	-- Landing support: remember the biggest recent downward speed.
	local down = -velocity.Y
	if down >= state.peakDownSpeed or now - state.peakDownAt > Config.Landing.RecentWindow then
		state.peakDownSpeed = math.max(down, 0)
		state.peakDownAt = now
	end

	if not state.flying then
		return
	end

	-- Anti-exploit speed check while flying.
	local horizontal = Vector3.new(velocity.X, 0, velocity.Z).Magnitude
	local tolerance = FLIGHT.SpeedTolerance
	local tooFast = horizontal > FLIGHT.Speed * tolerance
		or velocity.Y > FLIGHT.Speed * tolerance
		or -velocity.Y > FLIGHT.DiveSpeed * tolerance

	if tooFast then
		state.strikes += 1
		if state.strikes >= FLIGHT.StrikesBeforeRevoke then
			warn(
				string.format(
					"[All-Star] Flight revoked for %s (speed h=%.0f v=%.0f)",
					player.Name,
					horizontal,
					velocity.Y
				)
			)
			FlightService.forceStop(player, state, FLIGHT.RevokeCooldown)
			ServerNet.deny(player, Config.Actions.ToggleFlight, "speed")
		end
	else
		state.strikes = math.max(0, state.strikes - 0.5)
	end
end

function FlightService.start()
	local accumulator = 0
	RunService.PostSimulation:Connect(function(dt)
		accumulator += dt
		if accumulator < Config.Security.MonitorInterval then
			return
		end
		accumulator = 0
		local now = os.clock()
		for player, state in PlayerState.all() do
			if player.Parent == Players then
				sample(player, state, now)
			end
		end
	end)
end

return FlightService
