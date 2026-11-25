--[[
	All-Star :: BlastController (client ModuleScript)

	Hold to charge, release to fire. Works identically for:
	  * the on-screen BLAST button (touch)
	  * E / left mouse (keyboard + mouse)
	  * R2 (gamepad)

	The client only sends WHEN charging starts and WHICH DIRECTION to fire.
	Damage, charge level, origin, cooldown and hit detection are all decided
	by the server (BlastService).

	Aiming: on touch / gamepad the blast goes to whatever is under the screen
	centre (crosshair); with a free mouse it goes to the mouse cursor.
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local Shared = ReplicatedStorage:WaitForChild("AllStar")
local Config = require(Shared:WaitForChild("Config"))
local VFX = require(Shared:WaitForChild("VFX"))
local CooldownTracker = require(Shared:WaitForChild("CooldownTracker"))

local BlastController = {}
BlastController.__index = BlastController

local BLAST = Config.Blast
local AIM_DISTANCE = 1000

export type BlastController = typeof(setmetatable(
	{} :: {
		character: Model,
		root: BasePart,
		request: RemoteEvent,
		cooldowns: CooldownTracker.CooldownTracker,
		charging: boolean,
		chargeStart: number,
		chargeToken: number,
		usingTouchAim: boolean,
	},
	BlastController
))

function BlastController.new(
	character: Model,
	root: BasePart,
	request: RemoteEvent,
	cooldowns: CooldownTracker.CooldownTracker
): BlastController
	return setmetatable({
		character = character,
		root = root,
		request = request,
		cooldowns = cooldowns,
		charging = false,
		chargeStart = 0,
		chargeToken = 0,
		usingTouchAim = false,
	}, BlastController)
end

-- 0..1 charge for the HUD meter (client-side estimate of the server's value).
function BlastController.GetCharge(self: BlastController): number?
	if not self.charging then
		return nil
	end
	return math.clamp((os.clock() - self.chargeStart) / BLAST.ChargeTime, 0, 1)
end

function BlastController.Begin(self: BlastController, fromTouch: boolean?)
	if self.charging or not self.cooldowns:IsReady("Blast") then
		return
	end
	self.usingTouchAim = fromTouch == true
	self.charging = true
	self.chargeStart = os.clock()
	self.chargeToken += 1
	local token = self.chargeToken
	self.request:FireServer(Config.Actions.ChargeStart)

	-- Auto-release just before the server's max hold time.
	task.delay(BLAST.MaxHoldTime - 0.1, function()
		if self.charging and self.chargeToken == token then
			self:Release()
		end
	end)
end

function BlastController._aimDirection(self: BlastController): Vector3?
	local camera = workspace.CurrentCamera
	if not camera then
		return nil
	end

	local ray: Ray
	local mouseFree = UserInputService.MouseEnabled
		and not self.usingTouchAim
		and UserInputService.MouseBehavior ~= Enum.MouseBehavior.LockCenter
	if mouseFree then
		local mouse = UserInputService:GetMouseLocation()
		ray = camera:ViewportPointToRay(mouse.X, mouse.Y)
	else
		local size = camera.ViewportSize
		ray = camera:ViewportPointToRay(size.X / 2, size.Y / 2)
	end

	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	params.FilterDescendantsInstances = { self.character, VFX.getContainer() }
	local result = workspace:Raycast(ray.Origin, ray.Direction * AIM_DISTANCE, params)
	local targetPoint = if result then result.Position else ray.Origin + ray.Direction * AIM_DISTANCE

	local origin = self.root.Position + Vector3.new(0, BLAST.OriginHeight, 0)
	local direction = targetPoint - origin
	if direction.Magnitude < 1 then
		direction = ray.Direction
	end
	return direction.Unit
end

function BlastController.Release(self: BlastController)
	if not self.charging then
		return
	end
	self.charging = false
	local charge = math.clamp((os.clock() - self.chargeStart) / BLAST.ChargeTime, 0, 1)

	local direction = self:_aimDirection()
	if not direction or not self.root.Parent then
		self.request:FireServer(Config.Actions.ChargeCancel)
		return
	end

	-- Face the shot when on foot (flight orientation is handled by FlightController).
	local flat = Vector3.new(direction.X, 0, direction.Z)
	if flat.Magnitude > 0.1 and self.character:GetAttribute(Config.Attributes.Flying) ~= true then
		self.root.CFrame = CFrame.lookAlong(self.root.Position, flat.Unit)
	end

	self.request:FireServer(Config.Actions.Fire, direction)

	-- Client-side prediction for snappy UI; the server's Feedback overrides it.
	local predicted = if charge >= BLAST.ExplosiveThreshold then Config.Cooldowns.ChargedBlast else Config.Cooldowns.Blast
	self.cooldowns:Start("Blast", predicted)
	VFX.muzzleFlash(self.root.Position + Vector3.new(0, BLAST.OriginHeight, 0) + direction * 2, charge)
end

function BlastController.Cancel(self: BlastController)
	if self.charging then
		self.charging = false
		self.request:FireServer(Config.Actions.ChargeCancel)
	end
end

function BlastController.Destroy(self: BlastController)
	self.charging = false
	self.chargeToken += 1
end

return BlastController
