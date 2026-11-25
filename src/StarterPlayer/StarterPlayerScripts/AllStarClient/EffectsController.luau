--[[
	All-Star :: EffectsController (client ModuleScript)

	Renders every All-Star effect for EVERY character this client can see:

	  * attribute AllStarFlying  -> flight trails + flight pose
	  * attribute AllStarCharging -> charge orb on the right hand + charge pose
	  * Vfx "BlastFired"          -> moving projectile (synced to server time)
	  * Vfx "BlastEnd"            -> impact sparks / explosion
	  * Vfx "Landing"             -> shockwave, cracks, dust + landing pose

	Purely cosmetic. Nothing here affects gameplay, so it is safe for the
	client to own it.
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Shared = ReplicatedStorage:WaitForChild("AllStar")
local Config = require(Shared:WaitForChild("Config"))
local Remotes = require(Shared:WaitForChild("Remotes"))
local VFX = require(Shared:WaitForChild("VFX"))
local Poses = require(Shared:WaitForChild("Poses"))
local Validation = require(Shared:WaitForChild("Validation"))

local EffectsController = {}

local ATTR = Config.Attributes
local MAX_VISUAL_PROJECTILES = 120

type VisualProjectile = {
	visual: VFX.Projectile,
	origin: Vector3,
	direction: Vector3,
	speed: number,
	maxRange: number,
	startTime: number,
}

local projectiles: { [number]: VisualProjectile } = {}
local projectileCount = 0

-- Optional hook so the local client can react to its own landing (move lock).
EffectsController.onLocalLanding = nil :: ((intensity: number) -> ())?

--------------------------------------------------------------------------
-- Per-character attribute watchers
--------------------------------------------------------------------------
local function watchCharacter(character: Model)
	local cleanupTrails: (() -> ())? = nil
	local orb: VFX.ChargeOrb? = nil
	local orbStart = 0
	local orbConnection: RBXScriptConnection? = nil

	local function updateFlying()
		local flying = character:GetAttribute(ATTR.Flying) == true
		Poses.setHeld(character, "Flight", flying, 0.25)
		if flying and not cleanupTrails then
			cleanupTrails = VFX.attachFlightTrails(character)
		elseif not flying and cleanupTrails then
			cleanupTrails()
			cleanupTrails = nil
		end
	end

	local function stopOrb()
		if orbConnection then
			orbConnection:Disconnect()
			orbConnection = nil
		end
		if orb then
			orb.destroy()
			orb = nil
		end
	end

	local function updateCharging()
		local charging = character:GetAttribute(ATTR.Charging) == true
		Poses.setHeld(character, "Charge", charging, 0.12)
		if charging and not orb then
			local hand = character:FindFirstChild("RightHand")
			if hand and hand:IsA("BasePart") then
				orb = VFX.createChargeOrb(hand)
				orbStart = os.clock()
				orbConnection = RunService.PreRender:Connect(function()
					if orb then
						orb.update(math.clamp((os.clock() - orbStart) / Config.Blast.ChargeTime, 0, 1))
					end
				end)
			end
		elseif not charging then
			stopOrb()
		end
	end

	local connections = {
		character:GetAttributeChangedSignal(ATTR.Flying):Connect(updateFlying),
		character:GetAttributeChangedSignal(ATTR.Charging):Connect(updateCharging),
	}
	updateFlying()
	updateCharging()

	local cleaned = false
	local function cleanup()
		if cleaned then
			return
		end
		cleaned = true
		for _, connection in connections do
			connection:Disconnect()
		end
		stopOrb()
		if cleanupTrails then
			cleanupTrails()
			cleanupTrails = nil
		end
		Poses.forget(character)
	end
	-- Old characters may be destroyed OR just un-parented depending on
	-- workspace settings, so handle both.
	character.Destroying:Connect(cleanup)
	table.insert(
		connections,
		character.AncestryChanged:Connect(function()
			if not character:IsDescendantOf(game) then
				cleanup()
			end
		end)
	)
end

local function watchPlayer(player: Player)
	if player.Character then
		task.spawn(watchCharacter, player.Character)
	end
	player.CharacterAdded:Connect(watchCharacter)
end

--------------------------------------------------------------------------
-- Vfx remote handlers (server data is trusted but still type-checked)
--------------------------------------------------------------------------
local function onBlastFired(data: any)
	if projectileCount >= MAX_VISUAL_PROJECTILES then
		return
	end
	if
		typeof(data.id) ~= "number"
		or not Validation.isFiniteVector3(data.origin)
		or not Validation.isFiniteVector3(data.direction)
		or typeof(data.speed) ~= "number"
		or typeof(data.startTime) ~= "number"
	then
		return
	end
	local visual = VFX.createProjectile(data.radius or 1, data.charge or 0)
	projectiles[data.id] = {
		visual = visual,
		origin = data.origin,
		direction = data.direction,
		speed = data.speed,
		maxRange = data.maxRange or Config.Blast.MaxRange,
		startTime = data.startTime,
	}
	projectileCount += 1
	visual.setCFrame(CFrame.lookAlong(data.origin, data.direction))
end

local function removeProjectile(id: number)
	local projectile = projectiles[id]
	if projectile then
		projectile.visual.destroy()
		projectiles[id] = nil
		projectileCount -= 1
	end
end

local function onBlastEnd(data: any)
	if typeof(data.id) ~= "number" then
		return
	end
	removeProjectile(data.id)
	if data.impact and Validation.isFiniteVector3(data.position) then
		local normal = if Validation.isFiniteVector3(data.normal) then data.normal else Vector3.yAxis
		VFX.impact(data.position, normal, data.charge or 0, data.explosive == true, data.radius or 0)
	end
end

local function onLanding(data: any)
	if not Validation.isFiniteVector3(data.position) then
		return
	end
	local intensity = if typeof(data.intensity) == "number" then math.clamp(data.intensity, 0, 1) else 0
	local normal = if Validation.isFiniteVector3(data.normal) then data.normal else Vector3.yAxis
	VFX.landing(data.position, normal, intensity)

	local owner = if typeof(data.ownerId) == "number" then Players:GetPlayerByUserId(data.ownerId) else nil
	local character = owner and owner.Character
	if character then
		Poses.play(character, "Landing", Config.Landing.PoseTime)
	end
	if owner == Players.LocalPlayer and EffectsController.onLocalLanding then
		EffectsController.onLocalLanding(intensity)
	end
end

local function stepProjectiles()
	local now = workspace:GetServerTimeNow()
	for id, projectile in projectiles do
		local traveled = math.clamp((now - projectile.startTime) * projectile.speed, 0, projectile.maxRange)
		local position = projectile.origin + projectile.direction * traveled
		projectile.visual.setCFrame(CFrame.lookAlong(position, projectile.direction))
		-- Safety net if a BlastEnd packet never arrives.
		if now - projectile.startTime > projectile.maxRange / projectile.speed + 1 then
			removeProjectile(id)
		end
	end
end

function EffectsController.start()
	for _, player in Players:GetPlayers() do
		watchPlayer(player)
	end
	Players.PlayerAdded:Connect(watchPlayer)

	Remotes.get("Vfx").OnClientEvent:Connect(function(kind: any, data: any)
		if typeof(kind) ~= "string" or typeof(data) ~= "table" then
			return
		end
		if kind == "BlastFired" then
			onBlastFired(data)
		elseif kind == "BlastEnd" then
			onBlastEnd(data)
		elseif kind == "Landing" then
			onLanding(data)
		end
	end)

	RunService.PreRender:Connect(stepProjectiles)
end

return EffectsController
