--[[
	All-Star :: Client bootstrap (LocalScript, StarterPlayerScripts.AllStarClient)

	Creates the HUD once, (re)creates per-character controllers on every spawn,
	and routes all input (touch HUD, keyboard, mouse, gamepad) through one
	`actions` table so every control scheme behaves the same.

	Nothing here is trusted by the server. The client only ASKS for abilities;
	the server decides (see ServerScriptService.AllStarServer).
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Shared = ReplicatedStorage:WaitForChild("AllStar")
local Config = require(Shared:WaitForChild("Config"))
local Remotes = require(Shared:WaitForChild("Remotes"))
local CooldownTracker = require(Shared:WaitForChild("CooldownTracker"))
local VFX = require(Shared:WaitForChild("VFX"))

local FlightController = require(script:WaitForChild("FlightController"))
local BlastController = require(script:WaitForChild("BlastController"))
local EffectsController = require(script:WaitForChild("EffectsController"))
local InputController = require(script:WaitForChild("InputController"))
local HUD = require(script:WaitForChild("HUD"))

local player = Players.LocalPlayer
local request = Remotes.get("Request")
local feedback = Remotes.get("Feedback")
local ACTIONS = Config.Actions

local cooldowns = CooldownTracker.new()

-- Per-character state (replaced on every respawn).
local flight: FlightController.FlightController? = nil
local blast: BlastController.BlastController? = nil
local humanoid: Humanoid? = nil
local characterConnections: { RBXScriptConnection } = {}
local animationTracks: { [string]: AnimationTrack } = {}

local hud: HUD.HUD

--------------------------------------------------------------------------
-- Optional uploaded animations (Config.Animations). Empty IDs are skipped.
--------------------------------------------------------------------------
local function loadAnimations(hum: Humanoid)
	table.clear(animationTracks)
	local animator = hum:FindFirstChildOfClass("Animator")
	if not animator then
		return
	end
	for name, id in Config.Animations do
		if id ~= "" then
			local animation = Instance.new("Animation")
			animation.AnimationId = id
			local ok, track = pcall(animator.LoadAnimation, animator, animation)
			if ok and track then
				track.Priority = Enum.AnimationPriority.Action
				track.Looped = name ~= "Landing"
				animationTracks[name] = track
			else
				warn("[All-Star] Could not load animation", name, id)
			end
		end
	end
end

local function setTrack(name: string, playing: boolean)
	local track = animationTracks[name]
	if not track then
		return
	end
	if playing and not track.IsPlaying then
		track:Play(0.15)
	elseif not playing and track.IsPlaying then
		track:Stop(0.2)
	end
end

--------------------------------------------------------------------------
-- Actions (shared by every input method)
--------------------------------------------------------------------------
local function requestLand()
	request:FireServer(ACTIONS.Land)
end

local actions = {}

function actions.toggleFlight()
	if not flight then
		return
	end
	if not cooldowns:IsReady("FlightToggle") then
		hud:FlashDenied("FlightToggle")
		return
	end
	request:FireServer(ACTIONS.ToggleFlight, not flight:IsFlying())
end

function actions.beginBlast(fromTouch: boolean)
	if not blast then
		return
	end
	if not cooldowns:IsReady("Blast") then
		hud:FlashDenied("Blast")
		return
	end
	blast:Begin(fromTouch)
	setTrack("Charge", true)
end

function actions.releaseBlast()
	if blast then
		blast:Release()
	end
	setTrack("Charge", false)
end

function actions.land()
	if flight and flight:IsFlying() then
		flight:StartDive() -- dive; the landing fires when we hit the ground
	end
end

function actions.setVertical(source: string, value: number)
	if flight then
		flight:SetVertical(source, value)
	end
end

function actions.getCharge(): number?
	return if blast then blast:GetCharge() else nil
end

function actions.isFlying(): boolean
	return flight ~= nil and flight:IsFlying()
end

--------------------------------------------------------------------------
-- Server feedback
--------------------------------------------------------------------------
feedback.OnClientEvent:Connect(function(kind: any, a: any, b: any)
	if kind == "Cooldown" and typeof(a) == "string" and typeof(b) == "number" then
		cooldowns:Start(a, b)
	elseif kind == "Denied" and typeof(a) == "string" then
		if a == ACTIONS.Fire and b == "limit" then
			cooldowns:Reset("Blast") -- our prediction was wrong
		end
		local key = if a == ACTIONS.ToggleFlight
			then "FlightToggle"
			elseif a == ACTIONS.Land then "Landing"
			else "Blast"
		if b ~= "too_slow" and b ~= "airborne" then
			hud:FlashDenied(key)
		end
	end
end)

--------------------------------------------------------------------------
-- Local landing reaction (movement lock while the pose plays)
--------------------------------------------------------------------------
EffectsController.onLocalLanding = function(_intensity: number)
	local hum = humanoid
	if not hum then
		return
	end
	setTrack("Landing", true)
	local previousSpeed = hum.WalkSpeed
	hum.WalkSpeed = 0
	task.delay(Config.Landing.MoveLockTime, function()
		if hum.Parent and hum.WalkSpeed == 0 then
			hum.WalkSpeed = previousSpeed
		end
	end)
end

--------------------------------------------------------------------------
-- Character lifecycle
--------------------------------------------------------------------------
local function cleanupCharacter()
	for _, connection in characterConnections do
		connection:Disconnect()
	end
	table.clear(characterConnections)
	if flight then
		flight:Destroy()
		flight = nil
	end
	if blast then
		blast:Destroy()
		blast = nil
	end
	humanoid = nil
	table.clear(animationTracks)
end

local function onCharacterAdded(character: Model)
	cleanupCharacter()

	local hum = character:WaitForChild("Humanoid", 10)
	local root = character:WaitForChild("HumanoidRootPart", 10)
	if not hum or not hum:IsA("Humanoid") or not root or not root:IsA("BasePart") then
		warn("[All-Star] Character missing Humanoid/HumanoidRootPart")
		return
	end
	if hum.RigType ~= Enum.HumanoidRigType.R15 then
		warn("[All-Star] R15 is required for poses/armor. Set Game Settings > Avatar > R15.")
	end
	humanoid = hum
	loadAnimations(hum)

	local newFlight = FlightController.new(character, hum, root)
	newFlight.onFlyingChanged = function(isFlying: boolean)
		hud:SetFlying(isFlying)
		setTrack("Flight", isFlying)
	end
	newFlight.onGroundImpact = requestLand
	flight = newFlight
	hud:SetFlying(newFlight:IsFlying())

	blast = BlastController.new(character, root, request, cooldowns)

	-- Superhero landing from big falls (not only from flight dives).
	local peakFallSpeed = 0
	table.insert(
		characterConnections,
		RunService.PreSimulation:Connect(function()
			if hum:GetState() == Enum.HumanoidStateType.Freefall then
				peakFallSpeed = math.max(peakFallSpeed, -root.AssemblyLinearVelocity.Y)
			end
		end)
	)
	table.insert(
		characterConnections,
		hum.StateChanged:Connect(function(old, new)
			if new == Enum.HumanoidStateType.Landed and old == Enum.HumanoidStateType.Freefall then
				local speed = peakFallSpeed
				peakFallSpeed = 0
				if
					Config.Landing.AutoFromFalls
					and speed >= Config.Landing.MinImpactSpeed
					and cooldowns:IsReady("Landing")
				then
					requestLand()
				end
			elseif new ~= Enum.HumanoidStateType.Freefall then
				peakFallSpeed = 0
			end
		end)
	)
	table.insert(
		characterConnections,
		hum.Died:Connect(function()
			if blast then
				blast:Cancel()
			end
		end)
	)
end

--------------------------------------------------------------------------
-- Boot
--------------------------------------------------------------------------
hud = HUD.new(actions :: any, cooldowns)
EffectsController.start()
InputController.start(actions)
VFX.getContainer()

player.CharacterAdded:Connect(onCharacterAdded)
if player.Character then
	task.spawn(onCharacterAdded, player.Character)
end
