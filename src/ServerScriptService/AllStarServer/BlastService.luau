--[[
	All-Star :: BlastService (server ModuleScript)

	Server-authoritative energy blasts.

	  ChargeStart  -> server records the start time itself (client timing is ignored)
	  Fire(dir)    -> server validates dir, computes charge from ITS clock,
	                  spawns a simulated projectile at ITS idea of the hero's
	                  position, and steps it with workspace:Spherecast.
	  ChargeCancel -> clears the charge

	No projectile parts exist on the server: projectiles are just tables, and
	clients render them from the broadcast (origin, direction, speed, start time).
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Shared = ReplicatedStorage:WaitForChild("AllStar")
local Config = require(Shared:WaitForChild("Config"))
local Validation = require(Shared:WaitForChild("Validation"))

local PlayerState = require(script.Parent:WaitForChild("PlayerState"))
local ServerNet = require(script.Parent:WaitForChild("ServerNet"))
local DamageService = require(script.Parent:WaitForChild("DamageService"))

local BlastService = {}

local BLAST = Config.Blast
local ATTR = Config.Attributes

type Projectile = {
	id: number,
	owner: Player,
	state: PlayerState.State,
	params: RaycastParams,
	position: Vector3,
	direction: Vector3,
	radius: number,
	traveled: number,
	charge: number,
	damage: number,
	explosive: boolean,
}

local projectiles: { Projectile } = {}
local nextId = 0

local function lerp(a: number, b: number, t: number): number
	return a + (b - a) * t
end

local function clearCharge(state: PlayerState.State, character: Model?)
	state.charging = false
	state.chargeToken += 1
	if character then
		character:SetAttribute(ATTR.Charging, false)
	end
end

function BlastService.handleChargeStart(player: Player, state: PlayerState.State, character: Model, _payload: any)
	if state.charging then
		return
	end
	if not state.cooldowns:IsReady("Blast") then
		ServerNet.deny(player, Config.Actions.ChargeStart, "cooldown")
		return
	end
	state.charging = true
	state.chargeStart = os.clock()
	state.chargeToken += 1
	local token = state.chargeToken
	character:SetAttribute(ATTR.Charging, true)

	-- Housekeeping: a client that never releases cannot hold a charge forever.
	task.delay(BLAST.MaxHoldTime + 1, function()
		if state.charging and state.chargeToken == token then
			clearCharge(state, player.Character)
		end
	end)
end

function BlastService.handleChargeCancel(_player: Player, state: PlayerState.State, character: Model, _payload: any)
	if state.charging then
		clearCharge(state, character)
	end
end

local function finish(projectile: Projectile, position: Vector3, normal: Vector3, hit: BasePart?)
	projectile.state.activeBlasts = math.max(0, projectile.state.activeBlasts - 1)

	if hit then
		local humanoid, model = DamageService.getHumanoidFromPart(hit)
		if humanoid and model then
			DamageService.apply(projectile.owner, humanoid, model, projectile.damage)
		end
	end

	local explosionRadius = 0
	if projectile.explosive and hit then
		explosionRadius = lerp(BLAST.ExplosionRadiusMin, BLAST.ExplosionRadiusMax, projectile.charge)
		DamageService.explode(
			projectile.owner,
			position,
			explosionRadius,
			lerp(BLAST.ExplosionDamageMin, BLAST.ExplosionDamageMax, projectile.charge),
			BLAST.ExplosionDamageMin * 0.5,
			BLAST.NpcKnockback
		)
	end

	ServerNet.broadcast("BlastEnd", {
		id = projectile.id,
		position = position,
		normal = normal,
		charge = projectile.charge,
		impact = hit ~= nil,
		explosive = projectile.explosive and hit ~= nil,
		radius = explosionRadius,
	})
end

function BlastService.handleFire(player: Player, state: PlayerState.State, character: Model, payload: any)
	-- 1) Validate the only client-supplied value: the aim direction.
	if not Validation.isUnitVector(payload, Config.Security.UnitVectorTolerance) then
		return
	end
	local direction = (payload :: Vector3).Unit

	-- 2) Cooldown and concurrency limits.
	if not state.cooldowns:IsReady("Blast") then
		ServerNet.deny(player, Config.Actions.Fire, "cooldown")
		return
	end
	if state.activeBlasts >= BLAST.MaxActivePerPlayer or #projectiles >= BLAST.MaxActiveGlobal then
		ServerNet.deny(player, Config.Actions.Fire, "limit")
		return
	end

	-- 3) Charge comes from the server's own clock.
	local charge = 0
	if state.charging then
		charge = math.clamp((os.clock() - state.chargeStart) / BLAST.ChargeTime, 0, 1)
	end
	clearCharge(state, character)
	local explosive = charge >= BLAST.ExplosiveThreshold

	local cooldown = if explosive then Config.Cooldowns.ChargedBlast else Config.Cooldowns.Blast
	state.cooldowns:Start("Blast", cooldown)
	ServerNet.cooldown(player, "Blast", cooldown)

	-- 4) Origin from the server's view of the character, never from the client.
	local root = character:FindFirstChild("HumanoidRootPart") :: BasePart
	local origin = root.Position + Vector3.new(0, BLAST.OriginHeight, 0)

	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	params.FilterDescendantsInstances = { character }

	nextId += 1
	local projectile: Projectile = {
		id = nextId,
		owner = player,
		state = state,
		params = params,
		position = origin,
		direction = direction,
		radius = lerp(BLAST.MinRadius, BLAST.MaxRadius, charge),
		traveled = 0,
		charge = charge,
		damage = lerp(BLAST.MinDamage, BLAST.MaxDamage, charge),
		explosive = explosive,
	}
	table.insert(projectiles, projectile)
	state.activeBlasts += 1

	ServerNet.broadcast("BlastFired", {
		id = projectile.id,
		ownerId = player.UserId,
		origin = origin,
		direction = direction,
		speed = BLAST.ProjectileSpeed,
		radius = projectile.radius,
		charge = charge,
		maxRange = BLAST.MaxRange,
		startTime = workspace:GetServerTimeNow(),
	})
end

local function step(dt: number)
	for i = #projectiles, 1, -1 do
		local projectile = projectiles[i]
		local remaining = BLAST.MaxRange - projectile.traveled
		local distance = math.min(BLAST.ProjectileSpeed * dt, remaining)
		local result = workspace:Spherecast(
			projectile.position,
			projectile.radius,
			projectile.direction * distance,
			projectile.params
		)
		if result then
			table.remove(projectiles, i)
			finish(projectile, result.Position, result.Normal, result.Instance)
		else
			projectile.position += projectile.direction * distance
			projectile.traveled += distance
			if projectile.traveled >= BLAST.MaxRange - 1e-3 then
				table.remove(projectiles, i)
				finish(projectile, projectile.position, -projectile.direction, nil)
			end
		end
	end
end

function BlastService.start()
	RunService.PostSimulation:Connect(step)
end

return BlastService
