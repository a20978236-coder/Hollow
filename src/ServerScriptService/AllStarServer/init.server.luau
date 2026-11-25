--[[
	All-Star :: Server bootstrap (Script, ServerScriptService.AllStarServer)

	Wires every server module together and owns the single entry point for
	client requests (Request RemoteEvent). Request pipeline:

	  1. action must be a whitelisted string        (drops garbage silently)
	  2. per-player token-bucket rate limit         (drops spam silently)
	  3. player must be an All-Star (Config.Access)
	  4. player must have a live character
	  5. handler validates its own payload (type / range / NaN / cooldown)
	  6. handler runs inside pcall so one bad request can't kill the listener
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("AllStar")
local Config = require(Shared:WaitForChild("Config"))
local Remotes = require(Shared:WaitForChild("Remotes"))
local Validation = require(Shared:WaitForChild("Validation"))

Remotes.init()

local RateLimiter = require(script:WaitForChild("RateLimiter"))
local PlayerState = require(script:WaitForChild("PlayerState"))
local ServerNet = require(script:WaitForChild("ServerNet"))
local FlightService = require(script:WaitForChild("FlightService"))
local BlastService = require(script:WaitForChild("BlastService"))
local LandingService = require(script:WaitForChild("LandingService"))
local CharacterOutfitter = require(script:WaitForChild("CharacterOutfitter"))
local TestArena = require(script:WaitForChild("TestArena"))

local ACTIONS = Config.Actions
local ATTR = Config.Attributes

type Handler = (Player, PlayerState.State, Model, any) -> ()

local handlers: { [string]: Handler } = {
	[ACTIONS.ToggleFlight] = FlightService.handleToggle,
	[ACTIONS.ChargeStart] = BlastService.handleChargeStart,
	[ACTIONS.ChargeCancel] = BlastService.handleChargeCancel,
	[ACTIONS.Fire] = BlastService.handleFire,
	[ACTIONS.Land] = LandingService.handleLand,
}

local limiter = RateLimiter.new(Config.Security.RequestsPerSecond, Config.Security.RequestBurst)

local function isHero(player: Player): boolean
	return Config.Access.GrantToAllPlayers or player:GetAttribute(Config.Access.HeroAttribute) == true
end

Remotes.get("Request").OnServerEvent:Connect(function(player: Player, action: any, payload: any)
	if typeof(action) ~= "string" then
		return
	end
	local handler = handlers[action]
	if not handler then
		return
	end
	if not limiter:Allow(player) then
		return
	end
	local state = PlayerState.get(player)
	if not state then
		return
	end
	if not isHero(player) then
		ServerNet.deny(player, action, "not_hero")
		return
	end
	local character = Validation.getAliveCharacter(player)
	if not character then
		return
	end

	local ok, err = pcall(handler, player, state, character, payload)
	if not ok then
		warn(string.format("[All-Star] %s request from %s errored: %s", action, player.Name, tostring(err)))
	end
end)

--------------------------------------------------------------------------
-- Player lifecycle
--------------------------------------------------------------------------
local function onCharacterAdded(player: Player, character: Model)
	local state = PlayerState.get(player)
	if state then
		PlayerState.resetForCharacter(state)
	end
	character:SetAttribute(ATTR.Flying, false)
	character:SetAttribute(ATTR.Charging, false)

	local humanoid = character:WaitForChild("Humanoid", 10)
	if humanoid and humanoid:IsA("Humanoid") then
		humanoid.Died:Connect(function()
			local current = PlayerState.get(player)
			if current and player.Character == character then
				PlayerState.resetForCharacter(current)
				character:SetAttribute(ATTR.Flying, false)
				character:SetAttribute(ATTR.Charging, false)
			end
		end)
	end
end

local function onPlayerAdded(player: Player)
	PlayerState.add(player)

	player.CharacterAdded:Connect(function(character)
		onCharacterAdded(player, character)
	end)
	player.CharacterAppearanceLoaded:Connect(function(character)
		if isHero(player) then
			CharacterOutfitter.apply(character)
		end
	end)

	if player.Character then
		onCharacterAdded(player, player.Character)
		if player:HasAppearanceLoaded() and isHero(player) then
			CharacterOutfitter.apply(player.Character)
		end
	end
end

Players.PlayerAdded:Connect(onPlayerAdded)
for _, player in Players:GetPlayers() do
	task.spawn(onPlayerAdded, player)
end

Players.PlayerRemoving:Connect(function(player)
	PlayerState.remove(player)
	limiter:Remove(player)
end)

FlightService.start()
BlastService.start()

if Config.Testing.BuildTestArena then
	TestArena.build()
end

print(string.format("[All-Star] Server ready (v%s)", Config.Version))
