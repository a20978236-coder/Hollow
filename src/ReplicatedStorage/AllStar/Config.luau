--[[
	All-Star :: Config (ModuleScript, ReplicatedStorage.AllStar.Config)

	Single source of truth for every tunable value. Shared by server and client.
	The SERVER is authoritative: changing a value here on the client cannot grant
	extra speed, damage or shorter cooldowns, because the server re-reads its own
	copy of this module and validates every request against it.

	The table is deep-frozen at the bottom so nothing can mutate it at runtime.
]]

local Config = {}

Config.Version = "1.0.0"

-- Who gets the All-Star kit.
Config.Access = {
	-- true  = every player spawns as All-Star (single-hero experience / testing).
	-- false = only players the server marks with player:SetAttribute(HeroAttribute, true).
	GrantToAllPlayers = true,
	HeroAttribute = "AllStarHero",
}

-- Palette taken from the "Lunar Prime Armor" character sheet.
Config.Colors = {
	ArmorBlack = Color3.fromRGB(14, 14, 18),
	ArmorTrim = Color3.fromRGB(232, 236, 244),
	ArmorSilver = Color3.fromRGB(190, 196, 206),
	EmblemWhite = Color3.fromRGB(255, 255, 255),
	EnergyWhite = Color3.fromRGB(245, 252, 255),
	EnergyCyan = Color3.fromRGB(70, 225, 255),
	Hair = Color3.fromRGB(22, 16, 13),
	Skin = Color3.fromRGB(141, 92, 62),
	UiBackground = Color3.fromRGB(10, 12, 18),
}

-- Custom cooldowns (seconds). Keys are shared by server feedback and the HUD.
Config.Cooldowns = {
	FlightToggle = 1.25,
	Blast = 0.45, -- quick tap blast
	ChargedBlast = 3.0, -- used instead of Blast when charge >= Blast.ExplosiveThreshold
	Landing = 4.0,
}

Config.Flight = {
	Speed = 70, -- studs/s cruise speed (any direction)
	VerticalSpeed = 45, -- studs/s from the up/down controls
	DiveSpeed = 150, -- studs/s straight down when the Land/Dive action is used mid-air
	Acceleration = 6, -- higher = snappier velocity changes
	Responsiveness = 22, -- AlignOrientation responsiveness
	TiltDegrees = 35, -- forward body pitch at full speed
	TakeoffBoost = 28, -- small upward pop when flight starts on the ground
	-- Server anti-exploit
	SpeedTolerance = 1.35, -- allowed multiplier over the legit max before a strike
	StrikesBeforeRevoke = 5, -- consecutive-ish strikes before flight is force-disabled
	RevokeCooldown = 6, -- flight cooldown applied after a revoke
}

Config.Blast = {
	ProjectileSpeed = 210,
	MaxRange = 420,
	MinRadius = 0.7, -- projectile collision radius at 0 charge
	MaxRadius = 2.4, -- ... at full charge
	MinDamage = 12, -- direct-hit damage at 0 charge
	MaxDamage = 45, -- direct-hit damage at full charge
	ChargeTime = 1.6, -- seconds to reach full charge
	MaxHoldTime = 6, -- charge is auto-released by the client / cleared by the server after this
	ExplosiveThreshold = 0.6, -- charge fraction at which a blast becomes explosive
	ExplosionRadiusMin = 8,
	ExplosionRadiusMax = 18,
	ExplosionDamageMin = 14,
	ExplosionDamageMax = 38,
	MaxActivePerPlayer = 6,
	MaxActiveGlobal = 80,
	OriginHeight = 1.2, -- projectile spawns this far above the HumanoidRootPart
	NpcKnockback = 55, -- impulse speed applied to server-owned (NPC) assemblies
}

Config.Landing = {
	MinImpactSpeed = 55, -- downward studs/s needed for a superhero landing
	RecentWindow = 1.0, -- impact speed must have been observed within this many seconds
	GroundCheckDistance = 9,
	ShockwaveRadius = 14,
	ShockwaveDamage = 10, -- set to 0 for a purely cosmetic landing
	MoveLockTime = 0.7, -- local movement lock while the pose plays
	PoseTime = 1.1,
	AutoFromFalls = true, -- also trigger from big falls, not only from flight dives
}

Config.Combat = {
	PvPEnabled = true,
	FriendlyFire = false, -- respects Teams when false
	CreatorTagLifetime = 2, -- seconds an ObjectValue "creator" tag stays on the victim
}

Config.Security = {
	RequestsPerSecond = 12, -- token-bucket refill rate per player
	RequestBurst = 20, -- bucket size
	UnitVectorTolerance = 0.05, -- |dir.Magnitude - 1| allowed
	MonitorInterval = 0.1, -- server velocity sampling period
}

-- Optional uploaded animations ("rbxassetid://123"). Empty = procedural poses only.
Config.Animations = {
	Flight = "",
	Charge = "",
	Landing = "",
}

Config.Appearance = {
	Enabled = true,
	ProceduralArmor = true,
	ProceduralHair = true, -- used when HairAccessoryIds is empty
	HairCurlCount = 70,
	-- Comma-separated catalog hair accessory IDs. When set, replaces procedural hair.
	HairAccessoryIds = "",
	-- Optional classic clothing template asset IDs (0 = none; body colors form the suit).
	ShirtTemplateId = 0,
	PantsTemplateId = 0,
	StripOtherAccessories = true, -- "helmetless": removes hats/face accessories
}

Config.Keybinds = {
	ToggleFlight = { Enum.KeyCode.F, Enum.KeyCode.ButtonY },
	Blast = { Enum.KeyCode.E, Enum.KeyCode.ButtonR2 },
	BlastMouse = true, -- also allow holding left mouse button
	Land = { Enum.KeyCode.G, Enum.KeyCode.ButtonB },
	Up = { Enum.KeyCode.Space, Enum.KeyCode.ButtonA },
	Down = { Enum.KeyCode.LeftControl, Enum.KeyCode.C, Enum.KeyCode.ButtonX },
}

-- Character attributes written ONLY by the server (clients just read them for VFX).
Config.Attributes = {
	Flying = "AllStarFlying",
	Charging = "AllStarCharging",
}

-- Whitelisted request actions (client -> server).
Config.Actions = {
	ToggleFlight = "ToggleFlight",
	ChargeStart = "ChargeStart",
	ChargeCancel = "ChargeCancel",
	Fire = "Fire",
	Land = "Land",
}

Config.Testing = {
	-- Builds target dummies, walls and a jump tower when the server starts.
	-- Turn OFF before publishing a real game.
	BuildTestArena = true,
	DummyRespawnTime = 4,
}

local function deepFreeze(t: { [any]: any })
	for _, value in t do
		if type(value) == "table" and not table.isfrozen(value) then
			deepFreeze(value)
		end
	end
	table.freeze(t)
end

deepFreeze(Config)

return Config
