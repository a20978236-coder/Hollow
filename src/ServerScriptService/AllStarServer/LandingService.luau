--[[
	All-Star :: LandingService (server ModuleScript)

	Superhero landing. The client says "I just landed"; the server decides
	whether that is true:

	  * the hero must be near the ground (server-side raycast)
	  * the server's own velocity sampler must have seen a downward speed
	    >= Config.Landing.MinImpactSpeed within Config.Landing.RecentWindow
	  * the Landing cooldown must be ready

	A valid landing ends flight, deals optional shockwave damage and broadcasts
	the effect. An invalid landing request still ends flight if the hero is on
	the ground (a dive into the floor should always stop flying).
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("AllStar")
local Config = require(Shared:WaitForChild("Config"))

local PlayerState = require(script.Parent:WaitForChild("PlayerState"))
local ServerNet = require(script.Parent:WaitForChild("ServerNet"))
local DamageService = require(script.Parent:WaitForChild("DamageService"))
local FlightService = require(script.Parent:WaitForChild("FlightService"))

local LandingService = {}

local LANDING = Config.Landing

function LandingService.handleLand(player: Player, state: PlayerState.State, character: Model, _payload: any)
	local root = character:FindFirstChild("HumanoidRootPart") :: BasePart

	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	params.FilterDescendantsInstances = { character }
	local ground = workspace:Raycast(root.Position, Vector3.new(0, -LANDING.GroundCheckDistance, 0), params)
	if not ground then
		ServerNet.deny(player, Config.Actions.Land, "airborne")
		return
	end

	if state.flying then
		FlightService.setFlying(player, state, character, false)
	end

	local now = os.clock()
	local recentEnough = now - state.peakDownAt <= LANDING.RecentWindow
	if not recentEnough or state.peakDownSpeed < LANDING.MinImpactSpeed then
		ServerNet.deny(player, Config.Actions.Land, "too_slow")
		return
	end
	if not state.cooldowns:IsReady("Landing") then
		ServerNet.deny(player, Config.Actions.Land, "cooldown")
		return
	end

	local intensity = math.clamp(
		(state.peakDownSpeed - LANDING.MinImpactSpeed) / (Config.Flight.DiveSpeed - LANDING.MinImpactSpeed),
		0,
		1
	)
	state.peakDownSpeed = 0
	state.cooldowns:Start("Landing", Config.Cooldowns.Landing)
	ServerNet.cooldown(player, "Landing", Config.Cooldowns.Landing)

	if LANDING.ShockwaveDamage > 0 then
		local radius = LANDING.ShockwaveRadius * (0.8 + 0.4 * intensity)
		DamageService.explode(
			player,
			ground.Position,
			radius,
			LANDING.ShockwaveDamage * (1 + intensity),
			LANDING.ShockwaveDamage * 0.4,
			Config.Blast.NpcKnockback * 0.6
		)
	end

	ServerNet.broadcast("Landing", {
		ownerId = player.UserId,
		position = ground.Position,
		normal = ground.Normal,
		intensity = intensity,
	})
end

return LandingService
