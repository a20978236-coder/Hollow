--[[
	All-Star :: HUD (client ModuleScript)

	Builds the whole UI in code (no .rbxm needed), see docs/UI_DESIGN.md.

	Touch devices: a thumb cluster on the right, placed ABOVE Roblox's own
	jump button so they never overlap.
	    BLAST (hold to charge, release to fire)   FLY / STOP   LAND
	    UP / DOWN appear only while flying.
	    A crosshair marks where blasts go (screen centre).

	Keyboard / gamepad: a compact ability bar at the bottom centre with key
	hints. Buttons there are clickable too.

	Every ability button shows its cooldown as a dark overlay + countdown.
	A charge meter appears while charging, with a tick at the explosive threshold.
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")

local Shared = ReplicatedStorage:WaitForChild("AllStar")
local Config = require(Shared:WaitForChild("Config"))
local CooldownTracker = require(Shared:WaitForChild("CooldownTracker"))

local HUD = {}
HUD.__index = HUD

local COLORS = Config.Colors
local FONT_HEAVY = Font.fromName("GothamSSm", Enum.FontWeight.Heavy)
local FONT_BOLD = Font.fromName("GothamSSm", Enum.FontWeight.Bold)

export type Callbacks = {
	toggleFlight: () -> (),
	beginBlast: (fromTouch: boolean) -> (),
	releaseBlast: () -> (),
	land: () -> (),
	setVertical: (source: string, value: number) -> (),
	getCharge: () -> number?,
	isFlying: () -> boolean,
}

type AbilityButton = {
	button: TextButton,
	overlay: Frame,
	countdown: TextLabel,
	stroke: UIStroke,
	cooldownKey: string?,
}

export type HUD = typeof(setmetatable(
	{} :: {
		gui: ScreenGui,
		buttons: { [string]: AbilityButton },
		chargeFrame: Frame,
		chargeFill: Frame,
		chargeLabel: TextLabel,
		crosshair: Frame,
		crosshairGui: ScreenGui,
		flightHint: TextLabel?,
		cooldowns: CooldownTracker.CooldownTracker,
		callbacks: Callbacks,
		isTouch: boolean,
		connections: { RBXScriptConnection },
	},
	HUD
))

--------------------------------------------------------------------------
-- Small builders
--------------------------------------------------------------------------
local function corner(parent: Instance, radius: UDim?)
	local c = Instance.new("UICorner")
	c.CornerRadius = radius or UDim.new(0.5, 0)
	c.Parent = parent
end

local function makeAbilityButton(
	parent: Instance,
	name: string,
	label: string,
	hint: string?,
	size: number,
	cooldownKey: string?
): AbilityButton
	local button = Instance.new("TextButton")
	button.Name = name
	button.Size = UDim2.fromOffset(size, size)
	button.AnchorPoint = Vector2.new(0.5, 0.5)
	button.BackgroundColor3 = COLORS.UiBackground
	button.BackgroundTransparency = 0.25
	button.AutoButtonColor = false
	button.Text = ""
	button.Active = true
	button.Parent = parent
	corner(button)

	local stroke = Instance.new("UIStroke")
	stroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	stroke.Color = COLORS.EnergyCyan
	stroke.Thickness = 2
	stroke.Parent = button

	local text = Instance.new("TextLabel")
	text.Name = "Label"
	text.BackgroundTransparency = 1
	text.Size = UDim2.fromScale(1, 1)
	text.FontFace = FONT_HEAVY
	text.Text = label
	text.TextColor3 = COLORS.EnergyWhite
	text.TextScaled = true
	text.Parent = button
	local pad = Instance.new("UIPadding")
	pad.PaddingLeft = UDim.new(0.18, 0)
	pad.PaddingRight = UDim.new(0.18, 0)
	pad.PaddingTop = UDim.new(0.3, 0)
	pad.PaddingBottom = UDim.new(0.3, 0)
	pad.Parent = text

	if hint then
		local hintLabel = Instance.new("TextLabel")
		hintLabel.Name = "Hint"
		hintLabel.BackgroundTransparency = 1
		hintLabel.AnchorPoint = Vector2.new(0.5, 0)
		hintLabel.Position = UDim2.new(0.5, 0, 1, 4)
		hintLabel.Size = UDim2.new(1.6, 0, 0, 14)
		hintLabel.FontFace = FONT_BOLD
		hintLabel.Text = hint
		hintLabel.TextSize = 12
		hintLabel.TextColor3 = COLORS.ArmorSilver
		hintLabel.Parent = button
	end

	local overlay = Instance.new("Frame")
	overlay.Name = "Cooldown"
	overlay.Size = UDim2.fromScale(1, 1)
	overlay.BackgroundColor3 = Color3.new(0, 0, 0)
	overlay.BackgroundTransparency = 0.35
	overlay.Visible = false
	overlay.ZIndex = 3
	overlay.Parent = button
	corner(overlay)

	local countdown = Instance.new("TextLabel")
	countdown.Name = "Countdown"
	countdown.BackgroundTransparency = 1
	countdown.Size = UDim2.fromScale(1, 1)
	countdown.FontFace = FONT_HEAVY
	countdown.TextColor3 = COLORS.EnergyWhite
	countdown.TextSize = math.floor(size * 0.3)
	countdown.ZIndex = 4
	countdown.Parent = overlay

	return {
		button = button,
		overlay = overlay,
		countdown = countdown,
		stroke = stroke,
		cooldownKey = cooldownKey,
	}
end

-- Press-and-hold that survives the finger sliding off the button.
local function bindHold(button: GuiButton, onDown: (fromTouch: boolean) -> (), onUp: () -> ()): RBXScriptConnection
	return button.InputBegan:Connect(function(input: InputObject)
		local isTouch = input.UserInputType == Enum.UserInputType.Touch
		if not isTouch and input.UserInputType ~= Enum.UserInputType.MouseButton1 then
			return
		end
		if input.UserInputState ~= Enum.UserInputState.Begin then
			return
		end
		onDown(isTouch)
		local changed: RBXScriptConnection
		changed = input:GetPropertyChangedSignal("UserInputState"):Connect(function()
			if input.UserInputState == Enum.UserInputState.End or input.UserInputState == Enum.UserInputState.Cancel then
				changed:Disconnect()
				onUp()
			end
		end)
	end)
end

local function bindTap(button: GuiButton, onTap: () -> ()): RBXScriptConnection
	return button.Activated:Connect(function()
		onTap()
	end)
end

--------------------------------------------------------------------------
-- Construction
--------------------------------------------------------------------------
function HUD.new(callbacks: Callbacks, cooldowns: CooldownTracker.CooldownTracker): HUD
	local playerGui = Players.LocalPlayer:WaitForChild("PlayerGui")
	for _, oldName in { "AllStarHUD", "AllStarCrosshair" } do
		local existing = playerGui:FindFirstChild(oldName)
		if existing then
			existing:Destroy()
		end
	end

	local gui = Instance.new("ScreenGui")
	gui.Name = "AllStarHUD"
	gui.ResetOnSpawn = false
	gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
	gui.ScreenInsets = Enum.ScreenInsets.CoreUISafeInsets
	gui.Parent = playerGui

	local isTouch = UserInputService.TouchEnabled and not UserInputService.KeyboardEnabled

	local self = setmetatable({
		gui = gui,
		buttons = {},
		cooldowns = cooldowns,
		callbacks = callbacks,
		isTouch = isTouch,
		connections = {},
	}, HUD) :: any

	-- Title badge (top centre, clear of Roblox's top-left menu buttons).
	local title = Instance.new("TextLabel")
	title.Name = "Title"
	title.AnchorPoint = Vector2.new(0.5, 0)
	title.Position = UDim2.new(0.5, 0, 0, 6)
	title.Size = UDim2.fromOffset(160, 22)
	title.BackgroundColor3 = COLORS.UiBackground
	title.BackgroundTransparency = 0.35
	title.FontFace = FONT_HEAVY
	title.Text = "✦ ALL-STAR ✦"
	title.TextSize = 14
	title.TextColor3 = COLORS.EnergyWhite
	title.Parent = gui
	corner(title, UDim.new(0, 6))

	-- Ability buttons.
	if isTouch then
		local viewport = workspace.CurrentCamera and workspace.CurrentCamera.ViewportSize or Vector2.new(844, 390)
		local smallScreen = math.min(viewport.X, viewport.Y) <= 500
		-- Keep clear of Roblox's jump button (bottom-right corner).
		local baseY = if smallScreen then -150 else -260
		local cluster = Instance.new("Frame")
		cluster.Name = "TouchCluster"
		cluster.BackgroundTransparency = 1
		cluster.AnchorPoint = Vector2.new(1, 1)
		cluster.Position = UDim2.new(1, -12, 1, baseY + 150)
		cluster.Size = UDim2.fromOffset(260, 240)
		cluster.Parent = gui
		-- Positions are relative to the cluster's top-left (260 x 240 box).
		local blast = makeAbilityButton(cluster, "Blast", "BLAST", nil, 96, "Blast")
		blast.button.Position = UDim2.fromOffset(200, 150)
		local fly = makeAbilityButton(cluster, "Fly", "FLY", nil, 66, "FlightToggle")
		fly.button.Position = UDim2.fromOffset(100, 180)
		local land = makeAbilityButton(cluster, "Land", "LAND", nil, 58, "Landing")
		land.button.Position = UDim2.fromOffset(212, 52)
		local up = makeAbilityButton(cluster, "Up", "▲", nil, 56, nil)
		up.button.Position = UDim2.fromOffset(36, 110)
		local down = makeAbilityButton(cluster, "Down", "▼", nil, 56, nil)
		down.button.Position = UDim2.fromOffset(36, 180)
		self.buttons = { Blast = blast, Fly = fly, Land = land, Up = up, Down = down }
	else
		local bar = Instance.new("Frame")
		bar.Name = "AbilityBar"
		bar.BackgroundTransparency = 1
		bar.AnchorPoint = Vector2.new(0.5, 1)
		bar.Position = UDim2.new(0.5, 0, 1, -34)
		bar.Size = UDim2.fromOffset(240, 70)
		bar.Parent = gui
		local fly = makeAbilityButton(bar, "Fly", "FLY", "[F]", 62, "FlightToggle")
		fly.button.Position = UDim2.fromOffset(40, 35)
		local blast = makeAbilityButton(bar, "Blast", "BLAST", "[E] / hold LMB", 70, "Blast")
		blast.button.Position = UDim2.fromOffset(120, 35)
		local land = makeAbilityButton(bar, "Land", "LAND", "[G]", 62, "Landing")
		land.button.Position = UDim2.fromOffset(200, 35)
		self.buttons = { Blast = blast, Fly = fly, Land = land }

		local hint = Instance.new("TextLabel")
		hint.Name = "FlightHint"
		hint.BackgroundTransparency = 1
		hint.AnchorPoint = Vector2.new(0.5, 1)
		hint.Position = UDim2.new(0.5, 0, 0, -8)
		hint.Size = UDim2.fromOffset(320, 16)
		hint.FontFace = FONT_BOLD
		hint.TextSize = 13
		hint.TextColor3 = COLORS.ArmorSilver
		hint.Text = "WASD + camera to steer · Space up · Ctrl down · G dive-land"
		hint.Visible = false
		hint.Parent = bar
		self.flightHint = hint
	end

	-- Wire buttons.
	local b = self.buttons
	table.insert(self.connections, bindTap(b.Fly.button, callbacks.toggleFlight))
	table.insert(self.connections, bindTap(b.Land.button, callbacks.land))
	table.insert(self.connections, bindHold(b.Blast.button, callbacks.beginBlast, callbacks.releaseBlast))
	if b.Up then
		table.insert(
			self.connections,
			bindHold(b.Up.button, function()
				callbacks.setVertical("touchUp", 1)
			end, function()
				callbacks.setVertical("touchUp", 0)
			end)
		)
		table.insert(
			self.connections,
			bindHold(b.Down.button, function()
				callbacks.setVertical("touchDown", -1)
			end, function()
				callbacks.setVertical("touchDown", 0)
			end)
		)
	end

	-- Charge meter.
	local chargeFrame = Instance.new("Frame")
	chargeFrame.Name = "ChargeMeter"
	chargeFrame.AnchorPoint = Vector2.new(0.5, 0.5)
	chargeFrame.Position = UDim2.new(0.5, 0, 0.5, 46)
	chargeFrame.Size = UDim2.fromOffset(180, 10)
	chargeFrame.BackgroundColor3 = COLORS.UiBackground
	chargeFrame.BackgroundTransparency = 0.3
	chargeFrame.Visible = false
	chargeFrame.Parent = gui
	corner(chargeFrame, UDim.new(0, 5))

	local fill = Instance.new("Frame")
	fill.Name = "Fill"
	fill.Size = UDim2.fromScale(0, 1)
	fill.BackgroundColor3 = Color3.new(1, 1, 1)
	fill.Parent = chargeFrame
	corner(fill, UDim.new(0, 5))
	local gradient = Instance.new("UIGradient")
	gradient.Color = ColorSequence.new(COLORS.EnergyWhite, COLORS.EnergyCyan)
	gradient.Parent = fill

	local tick = Instance.new("Frame")
	tick.Name = "ExplosiveTick"
	tick.AnchorPoint = Vector2.new(0.5, 0.5)
	tick.Position = UDim2.fromScale(Config.Blast.ExplosiveThreshold, 0.5)
	tick.Size = UDim2.new(0, 2, 1.8, 0)
	tick.BackgroundColor3 = COLORS.EnergyWhite
	tick.BorderSizePixel = 0
	tick.ZIndex = 2
	tick.Parent = chargeFrame

	local chargeLabel = Instance.new("TextLabel")
	chargeLabel.Name = "Label"
	chargeLabel.BackgroundTransparency = 1
	chargeLabel.AnchorPoint = Vector2.new(0.5, 0)
	chargeLabel.Position = UDim2.new(0.5, 0, 1, 3)
	chargeLabel.Size = UDim2.new(1, 0, 0, 14)
	chargeLabel.FontFace = FONT_BOLD
	chargeLabel.TextSize = 12
	chargeLabel.TextColor3 = COLORS.EnergyWhite
	chargeLabel.Text = "CHARGING"
	chargeLabel.Parent = chargeFrame

	self.chargeFrame, self.chargeFill, self.chargeLabel = chargeFrame, fill, chargeLabel

	-- Crosshair at the exact viewport centre used for aiming. It lives in its
	-- own full-screen ScreenGui (no insets) so the centre matches the camera's.
	local crosshairGui = Instance.new("ScreenGui")
	crosshairGui.Name = "AllStarCrosshair"
	crosshairGui.ResetOnSpawn = false
	crosshairGui.IgnoreGuiInset = true
	crosshairGui.ScreenInsets = Enum.ScreenInsets.None
	crosshairGui.Parent = playerGui
	local crosshair = Instance.new("Frame")
	crosshair.Name = "Crosshair"
	crosshair.BackgroundTransparency = 1
	crosshair.AnchorPoint = Vector2.new(0.5, 0.5)
	crosshair.Position = UDim2.fromScale(0.5, 0.5)
	crosshair.Size = UDim2.fromOffset(22, 22)
	crosshair.Parent = crosshairGui
	for _, size in { UDim2.fromOffset(2, 22), UDim2.fromOffset(22, 2) } do
		local line = Instance.new("Frame")
		line.AnchorPoint = Vector2.new(0.5, 0.5)
		line.Position = UDim2.fromScale(0.5, 0.5)
		line.Size = size
		line.BackgroundColor3 = COLORS.EnergyWhite
		line.BackgroundTransparency = 0.2
		line.BorderSizePixel = 0
		line.Parent = crosshair
	end
	self.crosshair = crosshair
	self.crosshairGui = crosshairGui

	setmetatable(self, HUD)
	self:SetFlying(false)
	table.insert(
		self.connections,
		RunService.PreRender:Connect(function()
			self:_update()
		end)
	)
	return self
end

--------------------------------------------------------------------------
-- Updates
--------------------------------------------------------------------------
function HUD.SetFlying(self: HUD, flying: boolean)
	local b = self.buttons
	local label = b.Fly.button:FindFirstChild("Label") :: TextLabel?
	if label then
		label.Text = if flying then "STOP" else "FLY"
	end
	local landLabel = b.Land.button:FindFirstChild("Label") :: TextLabel?
	if landLabel then
		landLabel.Text = if flying then "DIVE" else "LAND"
	end
	if b.Up then
		b.Up.button.Visible = flying
		b.Down.button.Visible = flying
	end
	if self.flightHint then
		self.flightHint.Visible = flying
	end
end

function HUD.FlashDenied(self: HUD, cooldownKey: string)
	for _, entry in self.buttons do
		if entry.cooldownKey == cooldownKey then
			entry.stroke.Color = Color3.fromRGB(255, 80, 80)
			TweenService:Create(entry.stroke, TweenInfo.new(0.4), { Color = COLORS.EnergyCyan }):Play()
		end
	end
end

function HUD._update(self: HUD)
	-- Cooldown overlays.
	for _, entry in self.buttons do
		local key = entry.cooldownKey
		if key then
			local remaining = self.cooldowns:Get(key)
			if remaining > 0 then
				entry.overlay.Visible = true
				entry.countdown.Text = if remaining >= 1
					then string.format("%d", math.ceil(remaining))
					else string.format("%.1f", remaining)
			else
				entry.overlay.Visible = false
			end
		end
	end

	-- Charge meter.
	local charge = self.callbacks.getCharge()
	if charge then
		self.chargeFrame.Visible = true
		self.chargeFill.Size = UDim2.fromScale(charge, 1)
		local explosive = charge >= Config.Blast.ExplosiveThreshold
		self.chargeLabel.Text = if explosive then "EXPLOSIVE" else "CHARGING"
		self.chargeLabel.TextColor3 = if explosive then COLORS.EnergyCyan else COLORS.EnergyWhite
	else
		self.chargeFrame.Visible = false
	end

	-- Crosshair: shown when blasts aim at screen centre.
	local centreAim = self.isTouch
		or UserInputService.MouseBehavior == Enum.MouseBehavior.LockCenter
		or (UserInputService.GamepadEnabled and not UserInputService.MouseEnabled)
	self.crosshair.Visible = centreAim
end

function HUD.Destroy(self: HUD)
	for _, connection in self.connections do
		connection:Disconnect()
	end
	self.gui:Destroy()
	self.crosshairGui:Destroy()
end

return HUD
