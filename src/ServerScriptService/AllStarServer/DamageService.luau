--[[
	All-Star :: DamageService (server ModuleScript)

	The ONLY place damage is applied. Handles target lookup, PvP / team rules,
	kill credit ("creator" ObjectValue tag), area damage with falloff and
	line-of-sight, and knockback for server-owned NPC assemblies.
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("AllStar")
local Config = require(Shared:WaitForChild("Config"))

local DamageService = {}

local MAX_OVERLAP_PARTS = 256

-- Walks up from a hit part to the Model that owns a Humanoid (handles accessories).
function DamageService.getHumanoidFromPart(part: BasePart): (Humanoid?, Model?)
	local model = part:FindFirstAncestorOfClass("Model")
	for _ = 1, 3 do
		if not model then
			return nil, nil
		end
		local humanoid = model:FindFirstChildOfClass("Humanoid")
		if humanoid then
			return humanoid, model
		end
		model = model:FindFirstAncestorOfClass("Model")
	end
	return nil, nil
end

function DamageService.canDamage(attacker: Player, humanoid: Humanoid, model: Model): boolean
	if humanoid.Health <= 0 then
		return false
	end
	if model == attacker.Character then
		return false -- no self-damage
	end
	local victim = Players:GetPlayerFromCharacter(model)
	if victim then
		if not Config.Combat.PvPEnabled then
			return false
		end
		if
			not Config.Combat.FriendlyFire
			and not attacker.Neutral
			and not victim.Neutral
			and attacker.Team ~= nil
			and attacker.Team == victim.Team
		then
			return false
		end
	end
	return true
end

local function tagCreator(humanoid: Humanoid, attacker: Player)
	local existing = humanoid:FindFirstChild("creator")
	if existing then
		existing:Destroy()
	end
	local tag = Instance.new("ObjectValue")
	tag.Name = "creator"
	tag.Value = attacker
	tag.Parent = humanoid
	task.delay(Config.Combat.CreatorTagLifetime, function()
		if tag.Parent then
			tag:Destroy()
		end
	end)
end

function DamageService.apply(attacker: Player, humanoid: Humanoid, model: Model, amount: number): boolean
	if amount <= 0 or not DamageService.canDamage(attacker, humanoid, model) then
		return false
	end
	tagCreator(humanoid, attacker)
	humanoid:TakeDamage(amount) -- respects ForceFields
	return true
end

local function knockback(model: Model, from: Vector3, speed: number)
	local root = model:FindFirstChild("HumanoidRootPart")
	if not root or not root:IsA("BasePart") or root.Anchored then
		return
	end
	-- Player characters are physically owned by their client; the server can
	-- only push assemblies it owns (NPCs).
	local ok, owner = pcall(root.GetNetworkOwner, root)
	if not ok or owner ~= nil then
		return
	end
	local direction = root.Position - from
	direction = if direction.Magnitude > 0.01 then direction.Unit else Vector3.yAxis
	direction = (direction + Vector3.new(0, 0.5, 0)).Unit
	root:ApplyImpulse(direction * speed * root.AssemblyMass)
end

--[[
	Radial damage. Damage falls off linearly from maxDamage at the centre to
	minDamage at the edge. Targets behind solid geometry are skipped.
	Returns how many humanoids were damaged.
]]
function DamageService.explode(
	attacker: Player,
	position: Vector3,
	radius: number,
	maxDamage: number,
	minDamage: number,
	knockbackSpeed: number?
): number
	local attackerCharacter = attacker.Character

	local overlap = OverlapParams.new()
	overlap.FilterType = Enum.RaycastFilterType.Exclude
	overlap.FilterDescendantsInstances = if attackerCharacter then { attackerCharacter } else {}
	overlap.MaxParts = MAX_OVERLAP_PARTS

	local parts = workspace:GetPartBoundsInRadius(position, radius, overlap)
	local seen: { [Humanoid]: boolean } = {}
	local hits = 0

	local losParams = RaycastParams.new()
	losParams.FilterType = Enum.RaycastFilterType.Exclude

	for _, part in parts do
		local humanoid, model = DamageService.getHumanoidFromPart(part)
		if not humanoid or not model or seen[humanoid] then
			continue
		end
		seen[humanoid] = true

		local root = model:FindFirstChild("HumanoidRootPart") or model.PrimaryPart
		local targetPos = if root and root:IsA("BasePart") then root.Position else part.Position
		local offset = targetPos - position
		local distance = offset.Magnitude

		-- Line of sight: anything solid between blast and target blocks it.
		if distance > 0.5 then
			losParams.FilterDescendantsInstances = if attackerCharacter then { attackerCharacter, model } else { model }
			local blocked = workspace:Raycast(position, offset, losParams)
			if blocked and blocked.Instance.CanCollide then
				continue
			end
		end

		local falloff = 1 - math.clamp(distance / radius, 0, 1)
		local amount = minDamage + (maxDamage - minDamage) * falloff
		if DamageService.apply(attacker, humanoid, model, amount) then
			hits += 1
			if knockbackSpeed and knockbackSpeed > 0 then
				knockback(model, position, knockbackSpeed * (0.4 + 0.6 * falloff))
			end
		end
	end
	return hits
end

return DamageService
