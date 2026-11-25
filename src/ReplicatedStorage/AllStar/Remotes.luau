--[[
	All-Star :: Remotes (ModuleScript, ReplicatedStorage.AllStar.Remotes)

	Creates (server) or finds (client) the three RemoteEvents the kit uses:

	  Request  client -> server   (action: string, payload: any)   every ability request
	  Feedback server -> client   (kind: string, ...)               cooldowns / denials
	  Vfx      server -> clients  (kind: string, data: table)       cosmetic broadcasts

	Only three remotes keeps the attack surface small; every Request is routed
	through one validated entry point on the server (AbilityService).
]]

local RunService = game:GetService("RunService")

local Remotes = {}

local FOLDER_NAME = "Remotes"
local NAMES = { "Request", "Feedback", "Vfx" }

local folder: Folder? = nil

local function getFolder(): Folder
	if folder then
		return folder
	end
	local parent = script.Parent
	if RunService:IsServer() then
		local existing = parent:FindFirstChild(FOLDER_NAME)
		if existing and existing:IsA("Folder") then
			folder = existing
		else
			local created = Instance.new("Folder")
			created.Name = FOLDER_NAME
			created.Parent = parent
			folder = created
		end
	else
		folder = parent:WaitForChild(FOLDER_NAME) :: Folder
	end
	return folder :: Folder
end

-- Server only: make sure every remote exists. Safe to call more than once.
function Remotes.init()
	assert(RunService:IsServer(), "Remotes.init() is server-only")
	local f = getFolder()
	for _, name in NAMES do
		if not f:FindFirstChild(name) then
			local remote = Instance.new("RemoteEvent")
			remote.Name = name
			remote.Parent = f
		end
	end
end

function Remotes.get(name: string): RemoteEvent
	assert(table.find(NAMES, name), "Unknown remote: " .. tostring(name))
	local f = getFolder()
	if RunService:IsServer() then
		Remotes.init()
		return f:FindFirstChild(name) :: RemoteEvent
	end
	return f:WaitForChild(name) :: RemoteEvent
end

return Remotes
