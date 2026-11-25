--[[
	All-Star :: VFX (ModuleScript, ReplicatedStorage.AllStar.VFX) — CLIENT ONLY

	Reusable builders for every cosmetic effect. All parts are created locally
	on each client inside workspace.AllStarFX_Local, are anchored or massless,
	and never collide, touch or block queries, so effects cost the server nothing.

	Only built-in rbxasset:// particle textures are used, so nothing needs to be
	uploaded. Swap them for your own decals later if you want.
]]

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")

local Config = require(script.Parent:WaitForChild("Config"))

local VFX = {}

local WHITE = Config.Colors.EnergyWhite
local CYAN = Config.Colors.EnergyCyan

local TEX_SPARKLE = "rbxasset://textures/particles/sparkles_main.dds"
local TEX_SMOKE = "rbxasset://textures/particles/smoke_main.dds"

local container: Folder? = nil

function VFX.getContainer(): Folder
	if container and container.Parent then
		return container
	end
	local folder = Instance.new("Folder")
	folder.Name = "AllStarFX_Local"
	folder.Parent = workspace
	container = folder
	return folder
end

local function makePart(props: { [string]: any }): Part
	local part = Instance.new("Part")
	part.Anchored = true
	part.CanCollide = false
	part.CanQuery = false
	part.CanTouch = false
	part.CastShadow = false
	part.Material = Enum.Material.Neon
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	for key, value in props do
		(part :: any)[key] = value
	end
	return part
end

local function energySequence(): ColorSequence
	return ColorSequence.new({
		ColorSequenceKeypoint.new(0, WHITE),
		ColorSequenceKeypoint.new(1, CYAN),
	})
end

local function tween(instance: Instance, time: number, goal: { [string]: any }, style: Enum.EasingStyle?)
	local info = TweenInfo.new(time, style or Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
	local t = TweenService:Create(instance, info, goal)
	t:Play()
	return t
end

-- CFrame whose X axis (a Cylinder's axis) points along `axis`.
local function axisFrame(position: Vector3, axis: Vector3): CFrame
	local helper = if math.abs(axis:Dot(Vector3.yAxis)) < 0.9 then Vector3.yAxis else Vector3.xAxis
	local perpendicular = axis:Cross(helper).Unit
	return CFrame.fromMatrix(position, axis, perpendicular)
end

local function burstEmitter(parent: Instance, props: { [string]: any }, count: number): ParticleEmitter
	local emitter = Instance.new("ParticleEmitter")
	emitter.Enabled = false
	emitter.LightEmission = 1
	emitter.Texture = TEX_SPARKLE
	for key, value in props do
		(emitter :: any)[key] = value
	end
	emitter.Parent = parent
	emitter:Emit(count)
	return emitter
end

--------------------------------------------------------------------------
-- Projectile
--------------------------------------------------------------------------
export type Projectile = {
	core: Part,
	shell: Part,
	setCFrame: (cf: CFrame) -> (),
	destroy: () -> (),
}

function VFX.createProjectile(radius: number, charge: number): Projectile
	local folder = VFX.getContainer()
	local diameter = radius * 2

	local core = makePart({
		Name = "BlastCore",
		Shape = Enum.PartType.Ball,
		Size = Vector3.one * diameter * 0.65,
		Color = WHITE,
	})
	local shell = makePart({
		Name = "BlastShell",
		Shape = Enum.PartType.Ball,
		Size = Vector3.one * diameter * 1.1,
		Color = CYAN,
		Transparency = 0.55,
	})

	local a0 = Instance.new("Attachment")
	a0.Position = Vector3.new(0, radius * 0.6, 0)
	a0.Parent = core
	local a1 = Instance.new("Attachment")
	a1.Position = Vector3.new(0, -radius * 0.6, 0)
	a1.Parent = core

	local trail = Instance.new("Trail")
	trail.Attachment0 = a0
	trail.Attachment1 = a1
	trail.Color = energySequence()
	trail.Transparency = NumberSequence.new(0.1, 1)
	trail.Lifetime = 0.18 + 0.15 * charge
	trail.LightEmission = 1
	trail.FaceCamera = true
	trail.Parent = core

	local light = Instance.new("PointLight")
	light.Color = CYAN
	light.Range = 8 + 10 * charge
	light.Brightness = 2
	light.Parent = core

	core.Parent = folder
	shell.Parent = folder

	return {
		core = core,
		shell = shell,
		setCFrame = function(cf: CFrame)
			core.CFrame = cf
			shell.CFrame = cf
		end,
		destroy = function()
			core:Destroy()
			shell:Destroy()
		end,
	}
end

--------------------------------------------------------------------------
-- Muzzle flash (local, instant feedback before the server echo arrives)
--------------------------------------------------------------------------
function VFX.muzzleFlash(position: Vector3, charge: number)
	local size = 1.2 + 2 * charge
	local flash = makePart({
		Shape = Enum.PartType.Ball,
		Size = Vector3.one * size,
		CFrame = CFrame.new(position),
		Color = WHITE,
		Transparency = 0.1,
	})
	flash.Parent = VFX.getContainer()
	tween(flash, 0.15, { Size = Vector3.one * size * 1.8, Transparency = 1 })
	task.delay(0.2, flash.Destroy, flash)
end

--------------------------------------------------------------------------
-- Impact / explosion
--------------------------------------------------------------------------
function VFX.impact(position: Vector3, normal: Vector3, charge: number, explosive: boolean, radius: number)
	local folder = VFX.getContainer()
	local cf = CFrame.new(position)

	if explosive then
		local blastSize = radius * 2
		local flash = makePart({
			Shape = Enum.PartType.Ball,
			Size = Vector3.one * 1,
			CFrame = cf,
			Color = WHITE,
			Transparency = 0,
		})
		local shell = makePart({
			Shape = Enum.PartType.Ball,
			Size = Vector3.one * 2,
			CFrame = cf,
			Color = CYAN,
			Transparency = 0.35,
		})
		local ringAxis = if normal.Magnitude > 0.5 then normal.Unit else Vector3.yAxis
		local ring = makePart({
			Shape = Enum.PartType.Cylinder,
			Size = Vector3.new(0.3, 2, 2),
			CFrame = axisFrame(position, ringAxis),
			Color = CYAN,
			Transparency = 0.2,
		})
		flash.Parent = folder
		shell.Parent = folder
		ring.Parent = folder

		local light = Instance.new("PointLight")
		light.Color = CYAN
		light.Range = radius * 2.5
		light.Brightness = 6
		light.Parent = flash

		tween(flash, 0.25, { Size = Vector3.one * blastSize * 0.8, Transparency = 1 })
		tween(shell, 0.45, { Size = Vector3.one * blastSize, Transparency = 1 })
		tween(ring, 0.5, { Size = Vector3.new(0.3, blastSize * 1.6, blastSize * 1.6), Transparency = 1 })
		tween(light, 0.45, { Brightness = 0 })

		local holder = makePart({ Size = Vector3.one * 0.2, CFrame = cf, Transparency = 1 })
		holder.Parent = folder
		local attachment = Instance.new("Attachment")
		attachment.Parent = holder
		burstEmitter(attachment, {
			Color = energySequence(),
			Size = NumberSequence.new(1.2, 0),
			Speed = NumberRange.new(radius * 2, radius * 4),
			SpreadAngle = Vector2.new(180, 180),
			Lifetime = NumberRange.new(0.3, 0.6),
			Drag = 4,
		}, 40)
		burstEmitter(attachment, {
			Texture = TEX_SMOKE,
			LightEmission = 0.3,
			Color = ColorSequence.new(Color3.fromRGB(200, 230, 255)),
			Transparency = NumberSequence.new(0.4, 1),
			Size = NumberSequence.new(radius * 0.4, radius * 0.9),
			Speed = NumberRange.new(radius, radius * 2),
			SpreadAngle = Vector2.new(180, 180),
			Lifetime = NumberRange.new(0.6, 1.1),
			Drag = 3,
		}, 14)

		task.delay(1.4, function()
			flash:Destroy()
			shell:Destroy()
			ring:Destroy()
			holder:Destroy()
		end)
		VFX.shakeIfNear(position, radius * 3, 0.6, 0.35)
	else
		local size = 1.5 + 2 * charge
		local spark = makePart({
			Shape = Enum.PartType.Ball,
			Size = Vector3.one * size,
			CFrame = cf,
			Color = CYAN,
			Transparency = 0.2,
		})
		spark.Parent = folder
		local attachment = Instance.new("Attachment")
		attachment.Parent = spark
		burstEmitter(attachment, {
			Color = energySequence(),
			Size = NumberSequence.new(0.5, 0),
			Speed = NumberRange.new(10, 22),
			SpreadAngle = Vector2.new(70, 70),
			EmissionDirection = Enum.NormalId.Top,
			Lifetime = NumberRange.new(0.15, 0.35),
		}, 12)
		tween(spark, 0.2, { Size = Vector3.one * size * 2, Transparency = 1 })
		task.delay(0.5, spark.Destroy, spark)
	end
end

--------------------------------------------------------------------------
-- Charge orb (follows a hand)
--------------------------------------------------------------------------
export type ChargeOrb = { update: (alpha: number) -> (), destroy: () -> () }

function VFX.createChargeOrb(hand: BasePart): ChargeOrb
	local folder = VFX.getContainer()
	local orb = makePart({
		Name = "ChargeOrb",
		Shape = Enum.PartType.Ball,
		Size = Vector3.one * 0.4,
		Color = WHITE,
		Anchored = false,
		Massless = true,
	})
	local halo = makePart({
		Name = "ChargeHalo",
		Shape = Enum.PartType.Ball,
		Size = Vector3.one * 0.8,
		Color = CYAN,
		Transparency = 0.6,
		Anchored = false,
		Massless = true,
	})
	-- Hand-space offset: with the arm extended, the hand's -Y points forward.
	local offset = CFrame.new(0, -0.75, 0)
	for _, part in { orb, halo } do
		part.CFrame = hand.CFrame * offset
		local weld = Instance.new("Weld")
		weld.Part0 = hand
		weld.Part1 = part
		weld.C0 = offset
		weld.Parent = part
		part.Parent = folder
	end

	local attachment = Instance.new("Attachment")
	attachment.Parent = orb
	local inward = Instance.new("ParticleEmitter")
	inward.Texture = TEX_SPARKLE
	inward.LightEmission = 1
	inward.Color = energySequence()
	inward.Size = NumberSequence.new(0.35, 0)
	inward.Shape = Enum.ParticleEmitterShape.Sphere
	inward.ShapeInOut = Enum.ParticleEmitterShapeInOut.Inward
	inward.ShapeStyle = Enum.ParticleEmitterShapeStyle.Surface
	inward.Speed = NumberRange.new(4, 6)
	inward.Lifetime = NumberRange.new(0.25, 0.35)
	inward.Rate = 20
	inward.Parent = attachment

	local light = Instance.new("PointLight")
	light.Color = CYAN
	light.Brightness = 1
	light.Range = 6
	light.Parent = orb

	local alive = true
	return {
		update = function(alpha: number)
			if not alive then
				return
			end
			local pulse = 1 + 0.08 * math.sin(os.clock() * 18)
			orb.Size = Vector3.one * (0.4 + 1.4 * alpha) * pulse
			halo.Size = Vector3.one * (0.8 + 2.4 * alpha) * pulse
			halo.Transparency = 0.6 - 0.25 * alpha
			inward.Rate = 20 + 120 * alpha
			light.Range = 6 + 10 * alpha
			light.Brightness = 1 + 3 * alpha
		end,
		destroy = function()
			alive = false
			orb:Destroy()
			halo:Destroy()
		end,
	}
end

--------------------------------------------------------------------------
-- Superhero landing
--------------------------------------------------------------------------
function VFX.landing(position: Vector3, normal: Vector3, intensity: number)
	local folder = VFX.getContainer()
	local up = if normal.Magnitude > 0.5 then normal.Unit else Vector3.yAxis
	local tangent = if math.abs(up:Dot(Vector3.xAxis)) < 0.9 then up:Cross(Vector3.xAxis).Unit else up:Cross(Vector3.zAxis).Unit
	local groundCF = CFrame.fromMatrix(position + up * 0.05, tangent, up)
	local reach = Config.Landing.ShockwaveRadius * (0.8 + 0.6 * intensity)

	-- Shockwave rings (cylinder axis = part X, so align X with the normal).
	for i, color in { WHITE, CYAN } do
		local ring = makePart({
			Shape = Enum.PartType.Cylinder,
			Size = Vector3.new(0.2, 2, 2),
			CFrame = CFrame.fromMatrix(position + up * (0.1 * i), up, tangent),
			Color = color,
			Transparency = 0.15,
		})
		ring.Parent = folder
		tween(ring, 0.45 + 0.15 * i, {
			Size = Vector3.new(0.2, reach * 2, reach * 2),
			Transparency = 1,
		})
		task.delay(0.8, ring.Destroy, ring)
	end

	-- Radial ground cracks.
	local crackCount = 8
	for i = 1, crackCount do
		local angle = (i / crackCount) * math.pi * 2 + math.random() * 0.3
		local length = 3 + math.random() * 4 * (0.5 + intensity)
		local crack = makePart({
			Material = Enum.Material.SmoothPlastic,
			Size = Vector3.new(0.25, 0.08, length),
			Color = Color3.fromRGB(25, 25, 30),
			CFrame = groundCF * CFrame.Angles(0, angle, 0) * CFrame.new(0, 0, -length / 2 - 0.6),
		})
		crack.Parent = folder
		task.delay(2.2, function()
			tween(crack, 0.6, { Transparency = 1 })
			task.delay(0.7, crack.Destroy, crack)
		end)
	end

	-- Dust + energy burst.
	local holder = makePart({ Size = Vector3.one * 0.2, CFrame = groundCF, Transparency = 1 })
	holder.Parent = folder
	local attachment = Instance.new("Attachment")
	attachment.Parent = holder
	burstEmitter(attachment, {
		Texture = TEX_SMOKE,
		LightEmission = 0,
		Color = ColorSequence.new(Color3.fromRGB(170, 170, 180)),
		Transparency = NumberSequence.new(0.35, 1),
		Size = NumberSequence.new(1.5, 4),
		Speed = NumberRange.new(14, 26),
		SpreadAngle = Vector2.new(5, 180),
		EmissionDirection = Enum.NormalId.Top,
		Lifetime = NumberRange.new(0.6, 1.2),
		Drag = 4,
		Acceleration = Vector3.new(0, -6, 0),
	}, 24)
	burstEmitter(attachment, {
		Color = energySequence(),
		Size = NumberSequence.new(0.6, 0),
		Speed = NumberRange.new(20, 40),
		SpreadAngle = Vector2.new(60, 60),
		EmissionDirection = Enum.NormalId.Top,
		Lifetime = NumberRange.new(0.3, 0.6),
		Drag = 3,
	}, 30)
	task.delay(1.6, holder.Destroy, holder)

	VFX.shakeIfNear(position, reach * 2, 0.5 + 0.5 * intensity, 0.4)
end

--------------------------------------------------------------------------
-- Flight trails (hands + feet). Returns a cleanup function.
--------------------------------------------------------------------------
function VFX.attachFlightTrails(character: Model): () -> ()
	local created: { Instance } = {}
	for _, limbName in { "LeftFoot", "RightFoot", "LeftHand", "RightHand" } do
		local limb = character:FindFirstChild(limbName)
		if not limb or not limb:IsA("BasePart") then
			continue
		end
		local a0 = Instance.new("Attachment")
		a0.Name = "AllStarTrailA"
		a0.Position = Vector3.new(0.15, 0, 0)
		a0.Parent = limb
		local a1 = Instance.new("Attachment")
		a1.Name = "AllStarTrailB"
		a1.Position = Vector3.new(-0.15, 0, 0)
		a1.Parent = limb
		local trail = Instance.new("Trail")
		trail.Attachment0 = a0
		trail.Attachment1 = a1
		trail.Color = energySequence()
		trail.Transparency = NumberSequence.new(0.3, 1)
		trail.Lifetime = 0.35
		trail.MinLength = 0.2
		trail.LightEmission = 1
		trail.FaceCamera = true
		trail.Parent = limb
		table.insert(created, trail)
		table.insert(created, a0)
		table.insert(created, a1)
	end
	return function()
		for _, instance in created do
			instance:Destroy()
		end
	end
end

--------------------------------------------------------------------------
-- Camera shake for the LOCAL player (uses Humanoid.CameraOffset).
--------------------------------------------------------------------------
local shakeToken = 0

function VFX.shake(magnitude: number, duration: number)
	local character = Players.LocalPlayer.Character
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	if not humanoid then
		return
	end
	shakeToken += 1
	local token = shakeToken
	local start = os.clock()
	local connection: RBXScriptConnection
	connection = RunService.PreRender:Connect(function()
		local t = os.clock() - start
		if token ~= shakeToken or t >= duration or not humanoid.Parent then
			connection:Disconnect()
			if token == shakeToken and humanoid.Parent then
				humanoid.CameraOffset = Vector3.zero
			end
			return
		end
		local falloff = 1 - t / duration
		local m = magnitude * falloff
		humanoid.CameraOffset = Vector3.new((math.random() - 0.5) * m, (math.random() - 0.5) * m, 0)
	end)
end

function VFX.shakeIfNear(position: Vector3, range: number, magnitude: number, duration: number)
	local camera = workspace.CurrentCamera
	if not camera then
		return
	end
	local distance = (camera.CFrame.Position - position).Magnitude
	if distance <= range then
		VFX.shake(magnitude * (1 - distance / range), duration)
	end
end

return VFX
