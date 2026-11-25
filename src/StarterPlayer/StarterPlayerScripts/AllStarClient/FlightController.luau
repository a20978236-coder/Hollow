--[[
	All-Star :: FlightController (client ModuleScript)

	Drives flight physics for the LOCAL character while the server says it is
	flying (character attribute AllStarFlying, written only by the server).

	Directional control comes from the standard PlayerModule ControlModule, so
	it works the same with the mobile thumbstick, keyboard WASD and gamepad.
	Movement is camera-relative and 3D: look up and push forward to climb.
	Up/Down buttons (or Space / Ctrl) add pure vertical movement.

	Physics: LinearVelocity (velocity) + AlignOrientation (body facing/tilt).
	The total speed is clamped to Config.Flight.Speed so legit play never trips
	the server's speed monitor.
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Shared = ReplicatedStorage:WaitForChild("AllStar")
local Config = require(Shared:WaitForChild("Config"))

local FlightController = {}
FlightController.__index = FlightController

local FLIGHT = Config.Flight
local MAX_FORCE = 1e7
local GROUND_PROBE = 3.6 -- studs below the root that count as "touching ground" while diving

local player = Players.LocalPlayer

local controls: any = nil
local function getControls(): any
	if controls then
		return controls
	end
	local ok, result = pcall(function()
		local playerModule = require(player:WaitForChild("PlayerScripts"):WaitForChild("PlayerModule") :: ModuleScript)
		return (playerModule :: any):GetControls()
	end)
	if ok then
		controls = result
	else
		warn("[All-Star] PlayerModule controls unavailable; flight uses Humanoid.MoveDirection:", result)
	end
	return controls
end

export type FlightController = typeof(setmetatable(
	{} :: {
		character: Model,
		humanoid: Humanoid,
		root: BasePart,
		flying: boolean,
		diving: boolean,
		vertical: { [string]: number }, -- input source -> -1..1
		velocity: Vector3,
		attachment: Attachment?,
		linear: LinearVelocity?,
		align: AlignOrientation?,
		stepConnection: RBXScriptConnection?,
		connections: { RBXScriptConnection },
		onGroundImpact: (() -> ())?,
		onFlyingChanged: ((boolean) -> ())?,
	},
	FlightController
))

function FlightController.new(character: Model, humanoid: Humanoid, root: BasePart): FlightController
	local self = setmetatable({
		character = character,
		humanoid = humanoid,
		root = root,
		flying = false,
		diving = false,
		vertical = {},
		velocity = Vector3.zero,
		attachment = nil,
		linear = nil,
		align = nil,
		stepConnection = nil,
		connections = {},
		onGroundImpact = nil,
		onFlyingChanged = nil,
	}, FlightController)

	table.insert(
		self.connections,
		character:GetAttributeChangedSignal(Config.Attributes.Flying):Connect(function()
			self:_sync()
		end)
	)
	self:_sync()
	return self
end

function FlightController.IsFlying(self: FlightController): boolean
	return self.flying
end

-- Vertical input from any source ("keyboard", "touch", ...), summed and clamped.
function FlightController.SetVertical(self: FlightController, source: string, value: number)
	self.vertical[source] = if value ~= 0 then value else nil
end

function FlightController.StartDive(self: FlightController)
	if self.flying then
		self.diving = true
	end
end

function FlightController._sync(self: FlightController)
	local shouldFly = self.character:GetAttribute(Config.Attributes.Flying) == true
	if shouldFly and not self.flying then
		self:_enable()
	elseif not shouldFly and self.flying then
		self:_disable()
	end
end

function FlightController._enable(self: FlightController)
	self.flying = true
	self.diving = false
	local root = self.root

	local attachment = Instance.new("Attachment")
	attachment.Name = "AllStarFlightAttachment"
	attachment.Parent = root

	local linear = Instance.new("LinearVelocity")
	linear.Name = "AllStarFlightVelocity"
	linear.Attachment0 = attachment
	linear.RelativeTo = Enum.ActuatorRelativeTo.World
	linear.VelocityConstraintMode = Enum.VelocityConstraintMode.Vector
	linear.MaxForce = MAX_FORCE
	linear.Parent = root

	local align = Instance.new("AlignOrientation")
	align.Name = "AllStarFlightOrientation"
	align.Mode = Enum.OrientationAlignmentMode.OneAttachment
	align.Attachment0 = attachment
	align.MaxTorque = MAX_FORCE
	align.Responsiveness = FLIGHT.Responsiveness
	align.RigidityEnabled = false
	local startLook = Vector3.new(root.CFrame.LookVector.X, 0, root.CFrame.LookVector.Z)
	align.CFrame = CFrame.lookAlong(Vector3.zero, if startLook.Magnitude > 0.01 then startLook.Unit else -Vector3.zAxis)
	align.Parent = root

	self.attachment, self.linear, self.align = attachment, linear, align

	-- Start from current momentum plus a small takeoff pop.
	self.velocity = root.AssemblyLinearVelocity + Vector3.new(0, FLIGHT.TakeoffBoost, 0)
	if self.velocity.Magnitude > FLIGHT.Speed then
		self.velocity = self.velocity.Unit * FLIGHT.Speed
	end
	self.humanoid.PlatformStand = true

	self.stepConnection = RunService.PreSimulation:Connect(function(dt)
		self:_step(dt)
	end)
	if self.onFlyingChanged then
		self.onFlyingChanged(true)
	end
end

function FlightController._disable(self: FlightController)
	self.flying = false
	self.diving = false
	if self.stepConnection then
		self.stepConnection:Disconnect()
		self.stepConnection = nil
	end
	for _, instance in { self.linear, self.align, self.attachment } do
		if instance then
			instance:Destroy()
		end
	end
	self.linear, self.align, self.attachment = nil, nil, nil
	if self.humanoid.Parent then
		self.humanoid.PlatformStand = false
		self.humanoid:ChangeState(Enum.HumanoidStateType.Freefall)
	end
	if self.onFlyingChanged then
		self.onFlyingChanged(false)
	end
end

function FlightController._moveInput(self: FlightController): Vector3
	local c = getControls()
	if c then
		local ok, move = pcall(c.GetMoveVector, c)
		if ok and typeof(move) == "Vector3" then
			return move
		end
	end
	-- Fallback: world-space MoveDirection converted to camera space.
	local camera = workspace.CurrentCamera
	local world = self.humanoid.MoveDirection
	if not camera or world.Magnitude < 0.01 then
		return Vector3.zero
	end
	local local_ = camera.CFrame:VectorToObjectSpace(world)
	return Vector3.new(local_.X, 0, local_.Z)
end

function FlightController._groundBelow(self: FlightController): RaycastResult?
	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	params.FilterDescendantsInstances = { self.character }
	local reach = self.humanoid.HipHeight + self.root.Size.Y / 2 + GROUND_PROBE
	return workspace:Raycast(self.root.Position, Vector3.new(0, -reach, 0), params)
end

function FlightController._step(self: FlightController, dt: number)
	local camera = workspace.CurrentCamera
	local linear, align = self.linear, self.align
	if not camera or not linear or not align or not self.root.Parent then
		return
	end

	local move = self:_moveInput()
	local camCF = camera.CFrame
	local direction = camCF.RightVector * move.X + camCF.LookVector * -move.Z
	if direction.Magnitude > 1 then
		direction = direction.Unit
	end

	local verticalInput = 0
	for _, value in self.vertical do
		verticalInput += value
	end
	verticalInput = math.clamp(verticalInput, -1, 1)

	local target: Vector3
	if self.diving then
		local flat = Vector3.new(direction.X, 0, direction.Z) * FLIGHT.Speed * 0.3
		target = flat + Vector3.new(0, -FLIGHT.DiveSpeed, 0)
	else
		target = direction * FLIGHT.Speed + Vector3.new(0, verticalInput * FLIGHT.VerticalSpeed, 0)
		if target.Magnitude > FLIGHT.Speed then
			target = target.Unit * FLIGHT.Speed
		end
	end

	local alpha = 1 - math.exp(-FLIGHT.Acceleration * dt)
	self.velocity = self.velocity:Lerp(target, alpha)
	linear.VectorVelocity = self.velocity

	-- Facing: travel direction when moving, camera heading when hovering.
	local flatVelocity = Vector3.new(self.velocity.X, 0, self.velocity.Z)
	local facing: Vector3
	local pitch = 0
	if flatVelocity.Magnitude > 4 and not self.diving then
		facing = flatVelocity.Unit
		pitch = -math.rad(FLIGHT.TiltDegrees) * math.clamp(flatVelocity.Magnitude / FLIGHT.Speed, 0, 1)
	else
		local look = Vector3.new(camCF.LookVector.X, 0, camCF.LookVector.Z)
		local rootLook = Vector3.new(self.root.CFrame.LookVector.X, 0, self.root.CFrame.LookVector.Z)
		if look.Magnitude > 0.01 then
			facing = look.Unit
		elseif rootLook.Magnitude > 0.01 then
			facing = rootLook.Unit
		else
			facing = -Vector3.zAxis -- looking straight down: avoid a NaN orientation
		end
	end
	align.CFrame = CFrame.lookAlong(Vector3.zero, facing) * CFrame.Angles(pitch, 0, 0)

	-- Dive impact detection: report once, the server decides what happens.
	if self.diving and self:_groundBelow() then
		self.diving = false
		if self.onGroundImpact then
			self.onGroundImpact()
		end
	end
end

function FlightController.Destroy(self: FlightController)
	if self.flying then
		self:_disable()
	end
	for _, connection in self.connections do
		connection:Disconnect()
	end
	table.clear(self.connections)
end

return FlightController
