--[[
	All-Star :: CharacterOutfitter (server ModuleScript)

	Turns any R15 avatar into All-Star (helmetless Lunar Prime armor):

	  1. HumanoidDescription pass: black body suit (body colors), skin-tone head,
	     strips hats/face accessories (helmetless), optional catalog hair and
	     clothing IDs from Config.Appearance.
	  2. Procedural armor: black plates with white trim welded to each R15 limb,
	     plus the white compass-star chest emblem built from WedgeParts.
	  3. Procedural dark curly hair (cluster of small spheres) when no hair
	     accessory ID is configured.

	Everything is built on the server so all players see the same look. All
	added parts are Massless, non-colliding and non-queryable, so they don't
	change physics, block blasts or cost collision time.

	See docs/CHARACTER_SPEC.md for the full design spec and for replacing these
	procedural parts with modeled MeshParts later.
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("AllStar")
local Config = require(Shared:WaitForChild("Config"))
local StarShape = require(Shared:WaitForChild("StarShape"))

local CharacterOutfitter = {}

local COLORS = Config.Colors
local APPEARANCE = Config.Appearance

local OUTFIT_NAME = "AllStarOutfit"

local function newPiece(name: string, size: Vector3, color: Color3, material: Enum.Material): Part
	local part = Instance.new("Part")
	part.Name = name
	part.Size = size
	part.Color = color
	part.Material = material
	part.Anchored = false
	part.CanCollide = false
	part.CanQuery = false
	part.CanTouch = false
	part.Massless = true
	part.CastShadow = false
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	return part
end

-- Welds `part` to `limb` at local offset `offset` and parents it to `folder`.
local function attach(part: BasePart, limb: BasePart, offset: CFrame, folder: Instance)
	part.CFrame = limb.CFrame * offset
	local weld = Instance.new("Weld")
	weld.Part0 = limb
	weld.Part1 = part
	weld.C0 = offset
	weld.Parent = part
	part.Parent = folder
end

local function limb(character: Model, name: string): BasePart?
	local part = character:FindFirstChild(name)
	if part and part:IsA("BasePart") then
		return part
	end
	return nil
end

--------------------------------------------------------------------------
-- 1. HumanoidDescription
--------------------------------------------------------------------------
local function applyDescription(humanoid: Humanoid)
	local ok, description = pcall(humanoid.GetAppliedDescription, humanoid)
	if not ok or not description then
		warn("[All-Star] Could not read HumanoidDescription:", description)
		return
	end

	-- Black under-suit; skin-tone head.
	description.HeadColor = COLORS.Skin
	description.TorsoColor = COLORS.ArmorBlack
	description.LeftArmColor = COLORS.ArmorBlack
	description.RightArmColor = COLORS.ArmorBlack
	description.LeftLegColor = COLORS.ArmorBlack
	description.RightLegColor = COLORS.ArmorBlack

	description.Shirt = APPEARANCE.ShirtTemplateId
	description.Pants = APPEARANCE.PantsTemplateId
	description.GraphicTShirt = 0

	if APPEARANCE.StripOtherAccessories then
		-- Helmetless: remove every rigid + layered accessory first.
		pcall(description.SetAccessories, description, {}, true)
		description.HatAccessory = ""
		description.FaceAccessory = ""
		description.NeckAccessory = ""
		description.ShouldersAccessory = ""
		description.FrontAccessory = ""
		description.BackAccessory = ""
		description.WaistAccessory = ""
		description.HairAccessory = ""
	end
	if APPEARANCE.HairAccessoryIds ~= "" then
		description.HairAccessory = APPEARANCE.HairAccessoryIds
	end

	local applied, err = pcall(humanoid.ApplyDescription, humanoid, description)
	if not applied then
		warn("[All-Star] ApplyDescription failed (procedural parts still applied):", err)
	end
end

--------------------------------------------------------------------------
-- 2. Armor
--------------------------------------------------------------------------
local function buildArmor(character: Model, folder: Folder)
	local black, trim, silver = COLORS.ArmorBlack, COLORS.ArmorTrim, COLORS.ArmorSilver
	local metal = Enum.Material.Metal
	local smooth = Enum.Material.SmoothPlastic

	local upper = limb(character, "UpperTorso")
	if upper then
		local s = upper.Size
		-- Chest plate.
		attach(
			newPiece("ChestPlate", Vector3.new(s.X * 0.96, s.Y * 0.72, 0.18), black, metal),
			upper,
			CFrame.new(0, s.Y * 0.1, -s.Z / 2 - 0.06),
			folder
		)
		-- White V trim on the chest plate (two angled bars).
		for _, side in { -1, 1 } do
			attach(
				newPiece("ChestTrim", Vector3.new(0.09, s.Y * 0.62, 0.06), trim, smooth),
				upper,
				CFrame.new(side * s.X * 0.22, s.Y * 0.08, -s.Z / 2 - 0.17) * CFrame.Angles(0, 0, side * math.rad(28)),
				folder
			)
			-- Side stripe under the arm.
			attach(
				newPiece("SideStripe", Vector3.new(0.06, s.Y * 0.85, s.Z * 0.55), trim, smooth),
				upper,
				CFrame.new(side * (s.X / 2 + 0.02), 0, 0),
				folder
			)
		end
		-- High collar.
		attach(
			newPiece("Collar", Vector3.new(s.X * 0.62, 0.28, s.Z * 0.95), black, metal),
			upper,
			CFrame.new(0, s.Y / 2 + 0.08, 0),
			folder
		)
		attach(
			newPiece("CollarTrim", Vector3.new(s.X * 0.64, 0.05, s.Z * 0.97), trim, smooth),
			upper,
			CFrame.new(0, s.Y / 2 + 0.2, 0),
			folder
		)
		-- Star emblem, built in UpperTorso local space then welded piece by piece.
		-- Frame +Z must face out of the chest (torso -Z), hence the 180deg turn.
		local emblemFrame = CFrame.new(0, s.Y * 0.12, -s.Z / 2 - 0.2) * CFrame.Angles(0, math.pi, 0)
		local emblem, pieces = StarShape.build(emblemFrame, {
			OuterRadius = s.Y * 0.32,
			Width = s.Y * 0.07,
			Thickness = 0.04,
			Color = COLORS.EmblemWhite,
			Material = Enum.Material.Neon,
			Name = "StarEmblem",
		})
		for _, piece in pieces do
			local localCF = piece.CFrame
			piece.CFrame = upper.CFrame * localCF
			local weld = Instance.new("Weld")
			weld.Part0 = upper
			weld.Part1 = piece
			weld.C0 = localCF
			weld.Parent = piece
		end
		emblem.Parent = folder
	end

	local lower = limb(character, "LowerTorso")
	if lower then
		local s = lower.Size
		attach(
			newPiece("Belt", Vector3.new(s.X * 1.04, 0.16, s.Z * 1.06), trim, smooth),
			lower,
			CFrame.new(0, s.Y * 0.3, 0),
			folder
		)
	end

	for _, side in { "Left", "Right" } do
		local sign = if side == "Left" then -1 else 1

		local upperArm = limb(character, side .. "UpperArm")
		if upperArm then
			local s = upperArm.Size
			attach(
				newPiece(side .. "ShoulderPad", Vector3.new(s.X * 1.3, s.Y * 0.42, s.Z * 1.3), black, metal),
				upperArm,
				CFrame.new(sign * 0.04, s.Y * 0.3, 0),
				folder
			)
			attach(
				newPiece(side .. "ShoulderTrim", Vector3.new(s.X * 1.34, 0.07, s.Z * 1.34), trim, smooth),
				upperArm,
				CFrame.new(sign * 0.04, s.Y * 0.08, 0),
				folder
			)
		end

		local lowerArm = limb(character, side .. "LowerArm")
		if lowerArm then
			local s = lowerArm.Size
			attach(
				newPiece(side .. "Gauntlet", Vector3.new(s.X * 1.12, s.Y * 0.6, s.Z * 1.12), black, metal),
				lowerArm,
				CFrame.new(0, -s.Y * 0.12, 0),
				folder
			)
			attach(
				newPiece(side .. "GauntletBand", Vector3.new(s.X * 1.16, 0.08, s.Z * 1.16), trim, smooth),
				lowerArm,
				CFrame.new(0, -s.Y * 0.36, 0),
				folder
			)
		end

		local upperLeg = limb(character, side .. "UpperLeg")
		if upperLeg then
			local s = upperLeg.Size
			attach(
				newPiece(side .. "ThighPlate", Vector3.new(s.X * 0.8, s.Y * 0.55, 0.14), black, metal),
				upperLeg,
				CFrame.new(0, s.Y * 0.05, -s.Z / 2 - 0.05),
				folder
			)
			attach(
				newPiece(side .. "ThighStripe", Vector3.new(0.07, s.Y * 0.9, s.Z * 0.5), trim, smooth),
				upperLeg,
				CFrame.new(sign * (s.X / 2 + 0.02), 0, 0),
				folder
			)
		end

		local lowerLeg = limb(character, side .. "LowerLeg")
		if lowerLeg then
			local s = lowerLeg.Size
			attach(
				newPiece(side .. "KneePad", Vector3.new(s.X * 0.85, s.Y * 0.28, 0.24), silver, metal),
				lowerLeg,
				CFrame.new(0, s.Y * 0.36, -s.Z / 2 - 0.08),
				folder
			)
			attach(
				newPiece(side .. "ShinGuard", Vector3.new(s.X * 1.1, s.Y * 0.55, s.Z * 1.1), black, metal),
				lowerLeg,
				CFrame.new(0, -s.Y * 0.12, 0),
				folder
			)
			attach(
				newPiece(side .. "ShinStripe", Vector3.new(0.07, s.Y * 0.55, 0.05), trim, smooth),
				lowerLeg,
				CFrame.new(0, -s.Y * 0.12, -s.Z * 0.55 - 0.03),
				folder
			)
		end

		local foot = limb(character, side .. "Foot")
		if foot then
			local s = foot.Size
			attach(
				newPiece(side .. "BootSole", Vector3.new(s.X * 1.08, s.Y * 0.35, s.Z * 1.08), trim, smooth),
				foot,
				CFrame.new(0, -s.Y * 0.32, 0),
				folder
			)
		end
	end
end

--------------------------------------------------------------------------
-- 3. Procedural curly hair
--------------------------------------------------------------------------
local function buildHair(character: Model, folder: Folder)
	local head = limb(character, "Head")
	if not head then
		return
	end
	local size = head.Size
	local radius = math.max(size.X, size.Z) * 0.5
	local rng = Random.new(1977) -- fixed seed: same haircut for everybody, every spawn
	local count = APPEARANCE.HairCurlCount
	local golden = math.pi * (3 - math.sqrt(5))
	local model = Instance.new("Model")
	model.Name = "CurlyHair"

	for i = 0, count * 2 - 1 do
		-- Fibonacci sphere over the whole head; keep the upper/back cap only.
		local y = 1 - (i / (count * 2 - 1)) * 2
		local ring = math.sqrt(1 - y * y)
		local theta = golden * i
		local dir = Vector3.new(math.cos(theta) * ring, y, math.sin(theta) * ring)

		local isTop = dir.Y > -0.05
		local isFace = dir.Z < -0.25 and dir.Y < 0.45 -- head front is -Z
		local isBackOfNeck = dir.Z > 0.2 and dir.Y > -0.45
		if not ((isTop and not isFace) or isBackOfNeck) then
			continue
		end

		local curlSize = size.X * rng:NextNumber(0.26, 0.36)
		local out = radius * rng:NextNumber(0.88, 1.02) + (if dir.Y > 0.5 then curlSize * 0.25 else 0)
		local offset = CFrame.new(dir * out + Vector3.new(0, size.Y * 0.08, 0))
		local curl = newPiece("Curl", Vector3.one * curlSize, COLORS.Hair, Enum.Material.SmoothPlastic)
		curl.Shape = Enum.PartType.Ball
		attach(curl, head, offset, model)
	end
	model.Parent = folder
end

--------------------------------------------------------------------------
-- Public
--------------------------------------------------------------------------
function CharacterOutfitter.apply(character: Model)
	if not APPEARANCE.Enabled then
		return
	end
	local humanoid = character:FindFirstChildOfClass("Humanoid")
	if not humanoid then
		return
	end
	if humanoid.RigType ~= Enum.HumanoidRigType.R15 then
		warn("[All-Star] Character is not R15; set Game Settings > Avatar to R15. Skipping outfit.")
		return
	end

	applyDescription(humanoid)
	if not character.Parent then
		return -- died / left while the description was applying
	end

	local old = character:FindFirstChild(OUTFIT_NAME)
	if old then
		old:Destroy()
	end
	local folder = Instance.new("Folder")
	folder.Name = OUTFIT_NAME

	if APPEARANCE.ProceduralArmor then
		buildArmor(character, folder)
	end
	if APPEARANCE.ProceduralHair and APPEARANCE.HairAccessoryIds == "" then
		buildHair(character, folder)
	end
	folder.Parent = character
end

return CharacterOutfitter
