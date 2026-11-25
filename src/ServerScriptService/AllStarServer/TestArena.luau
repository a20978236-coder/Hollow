--[[
	All-Star :: TestArena (server ModuleScript)

	Optional test content (Config.Testing.BuildTestArena). Builds:
	  * 5 respawning target dummies (simple Humanoid models, server-owned, so
	    damage AND knockback can be tested solo)
	  * a wall in front of one dummy (line-of-sight / blocked-explosion test)
	  * a 60-stud jump tower (superhero landing from a fall without flight)

	Disable it before publishing.
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("AllStar")
local Config = require(Shared:WaitForChild("Config"))

local TestArena = {}

local ORIGIN = Vector3.new(0, 0, -60)

local function anchoredPart(name: string, size: Vector3, cf: CFrame, color: Color3, parent: Instance): Part
	local part = Instance.new("Part")
	part.Name = name
	part.Size = size
	part.CFrame = cf
	part.Color = color
	part.Anchored = true
	part.Material = Enum.Material.Concrete
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	part.Parent = parent
	return part
end

local function buildDummy(position: Vector3, parent: Instance)
	local model = Instance.new("Model")
	model.Name = "TargetDummy"

	local root = Instance.new("Part")
	root.Name = "HumanoidRootPart"
	root.Size = Vector3.new(2, 2, 1)
	root.Transparency = 1
	root.CanCollide = false
	root.CFrame = CFrame.new(position + Vector3.new(0, 3, 0))
	root.Parent = model

	local torso = Instance.new("Part")
	torso.Name = "Torso"
	torso.Size = Vector3.new(2, 3, 1)
	torso.Color = Color3.fromRGB(60, 60, 70)
	torso.CFrame = root.CFrame
	torso.Parent = model

	local head = Instance.new("Part")
	head.Name = "Head"
	head.Size = Vector3.new(1.2, 1.2, 1.2)
	head.Color = Color3.fromRGB(90, 90, 100)
	head.CFrame = root.CFrame * CFrame.new(0, 2.1, 0)
	head.Parent = model

	for _, part in { torso, head } do
		local weld = Instance.new("WeldConstraint")
		weld.Part0 = root
		weld.Part1 = part
		weld.Parent = part
	end

	-- No legs: R15-style HipHeight keeps the root hovering upright instead of tipping.
	torso.CanCollide = false
	head.CanCollide = false
	root.CanCollide = true
	local humanoid = Instance.new("Humanoid")
	humanoid.RigType = Enum.HumanoidRigType.R15
	humanoid.HipHeight = 2
	humanoid.MaxHealth = 150
	humanoid.Health = 150
	humanoid.Parent = model

	model.PrimaryPart = root
	model.Parent = parent
	root:SetNetworkOwner(nil) -- server owns it, so knockback works

	humanoid.Died:Connect(function()
		task.delay(Config.Testing.DummyRespawnTime, function()
			model:Destroy()
			buildDummy(position, parent)
		end)
	end)
end

function TestArena.build()
	local folder = Instance.new("Folder")
	folder.Name = "AllStarTestArena"
	folder.Parent = workspace

	for i = -2, 2 do
		buildDummy(ORIGIN + Vector3.new(i * 12, 0, 0), folder)
	end

	-- LOS wall in front of the left-most dummy.
	anchoredPart(
		"CoverWall",
		Vector3.new(8, 10, 1),
		CFrame.new(ORIGIN + Vector3.new(-24, 5, 10)),
		Color3.fromRGB(45, 45, 55),
		folder
	)

	-- Jump tower with a top platform.
	local towerBase = Vector3.new(40, 0, 0)
	anchoredPart(
		"JumpTower",
		Vector3.new(10, 60, 10),
		CFrame.new(towerBase + Vector3.new(0, 30, 0)),
		Color3.fromRGB(30, 30, 38),
		folder
	)
	-- Stairs: a simple spiral of steps around the tower.
	for step = 0, 39 do
		local angle = step * math.rad(30)
		local height = 1.5 + step * 1.5
		local offset = Vector3.new(math.cos(angle) * 8, height, math.sin(angle) * 8)
		anchoredPart(
			"Step",
			Vector3.new(5, 1, 5),
			CFrame.new(towerBase + offset),
			Color3.fromRGB(70, 225, 255),
			folder
		)
	end
end

return TestArena
