--[[
	All-Star :: Validation (ModuleScript, ReplicatedStorage.AllStar.Validation)

	Pure helper functions for checking untrusted values that arrive over
	RemoteEvents. Never trust anything a client sends: type, range, NaN and
	infinity are all checked here.
]]

local Validation = {}

local MAX_COORD = 1e6

function Validation.isFiniteNumber(value: any): boolean
	return typeof(value) == "number" and value == value and value > -math.huge and value < math.huge
end

function Validation.isFiniteVector3(value: any, maxAbs: number?): boolean
	if typeof(value) ~= "Vector3" then
		return false
	end
	local limit = maxAbs or MAX_COORD
	for _, component in { value.X, value.Y, value.Z } do
		if not Validation.isFiniteNumber(component) or math.abs(component) > limit then
			return false
		end
	end
	return true
end

-- A direction must be finite and (close to) length 1.
function Validation.isUnitVector(value: any, tolerance: number): boolean
	if not Validation.isFiniteVector3(value, 2) then
		return false
	end
	return math.abs((value :: Vector3).Magnitude - 1) <= tolerance
end

function Validation.isBoolean(value: any): boolean
	return typeof(value) == "boolean"
end

-- Returns character, humanoid, root only if the player is spawned and alive.
function Validation.getAliveCharacter(player: Player): (Model?, Humanoid?, BasePart?)
	local character = player.Character
	if not character or not character.Parent then
		return nil, nil, nil
	end
	local humanoid = character:FindFirstChildOfClass("Humanoid")
	local root = character:FindFirstChild("HumanoidRootPart")
	if not humanoid or humanoid.Health <= 0 or not root or not root:IsA("BasePart") then
		return nil, nil, nil
	end
	return character, humanoid, root
end

return Validation
