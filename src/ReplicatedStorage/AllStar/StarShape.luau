--[[
	All-Star :: StarShape (ModuleScript, ReplicatedStorage.AllStar.StarShape)

	Builds the flat compass-star emblem (4 long points + 4 short diagonal points)
	out of WedgeParts, so the emblem needs no uploaded decal/texture asset.

	Geometry notes
	--------------
	A WedgePart's cross-section is a right triangle. Its right angle sits on the
	bottom-back edge; one leg runs along local -Z (length Size.Z) and the other
	along local +Y (length Size.Y); Size.X is the thickness.
	`placeTriangle` maps that triangle onto any right triangle given by a vertex
	P and two perpendicular legs a, b (all in the star's local plane, where the
	plane is X/Y and +Z is the emblem's facing normal).

	A star point is a thin diamond made of 4 such triangles.
]]

local StarShape = {}

export type StarOptions = {
	OuterRadius: number, -- length of the 4 main points
	Width: number, -- half-width of the main points at the center
	MinorRadius: number?, -- length of the diagonal points (default 0.55 * OuterRadius)
	Thickness: number?,
	Color: Color3,
	Material: Enum.Material?,
	Name: string?,
}

local function placeTriangle(
	frame: CFrame,
	p: Vector3,
	a: Vector3,
	b: Vector3,
	thickness: number,
	template: WedgePart
): (WedgePart, CFrame)
	local zAxis = frame:VectorToWorldSpace(-a.Unit)
	local yAxis = frame:VectorToWorldSpace(b.Unit)
	local xAxis = yAxis:Cross(zAxis)
	local center = frame:PointToWorldSpace(p + a / 2 + b / 2)

	local wedge = template:Clone()
	wedge.Size = Vector3.new(thickness, b.Magnitude, a.Magnitude)
	local cf = CFrame.fromMatrix(center, xAxis, yAxis, zAxis)
	wedge.CFrame = cf
	return wedge, cf
end

-- Adds a diamond (one long point pair) built from 4 triangles.
local function addDiamond(
	frame: CFrame,
	halfAlong: number,
	halfAcross: number,
	thickness: number,
	template: WedgePart,
	out: { WedgePart }
)
	for _, sx in { 1, -1 } do
		for _, sy in { 1, -1 } do
			local a = Vector3.new(sx * halfAcross, 0, 0)
			local b = Vector3.new(0, sy * halfAlong, 0)
			local wedge = placeTriangle(frame, Vector3.zero, a, b, thickness, template)
			table.insert(out, wedge)
		end
	end
end

--[[
	Builds the emblem centred on `frame` (frame.LookVector points AWAY from the
	surface the star faces out of; i.e. +Z of `frame` is the visible normal).
	Returns a Model whose parts are not yet welded or parented.
]]
function StarShape.build(frame: CFrame, options: StarOptions): (Model, { WedgePart })
	local thickness = options.Thickness or 0.05
	local minor = options.MinorRadius or options.OuterRadius * 0.55

	local template = Instance.new("WedgePart")
	template.Anchored = false
	template.CanCollide = false
	template.CanQuery = false
	template.CanTouch = false
	template.Massless = true
	template.CastShadow = false
	template.Color = options.Color
	template.Material = options.Material or Enum.Material.Neon
	template.TopSurface = Enum.SurfaceType.Smooth
	template.BottomSurface = Enum.SurfaceType.Smooth

	local parts: { WedgePart } = {}
	-- Vertical and horizontal long points.
	addDiamond(frame, options.OuterRadius, options.Width, thickness, template, parts)
	addDiamond(frame * CFrame.Angles(0, 0, math.rad(90)), options.OuterRadius, options.Width, thickness, template, parts)
	-- Short diagonal points.
	addDiamond(frame * CFrame.Angles(0, 0, math.rad(45)), minor, options.Width * 0.7, thickness, template, parts)
	addDiamond(frame * CFrame.Angles(0, 0, math.rad(-45)), minor, options.Width * 0.7, thickness, template, parts)

	template:Destroy()

	local model = Instance.new("Model")
	model.Name = options.Name or "StarEmblem"
	for i, part in parts do
		part.Name = "StarPiece" .. i
		part.Parent = model
	end
	return model, parts
end

return StarShape
