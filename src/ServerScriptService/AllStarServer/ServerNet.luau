--[[
	All-Star :: ServerNet (server ModuleScript)

	Thin wrapper around the Feedback and Vfx remotes so services never build
	remote payloads by hand.
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("AllStar")
local Remotes = require(Shared:WaitForChild("Remotes"))

local feedback = Remotes.get("Feedback")
local vfx = Remotes.get("Vfx")

local ServerNet = {}

-- Tell one client that `key` is on cooldown for `duration` seconds.
function ServerNet.cooldown(player: Player, key: string, duration: number)
	feedback:FireClient(player, "Cooldown", key, duration)
end

-- Tell one client a request was refused (HUD can flash / reset prediction).
function ServerNet.deny(player: Player, action: string, reason: string)
	feedback:FireClient(player, "Denied", action, reason)
end

-- Broadcast a cosmetic event to every client.
function ServerNet.broadcast(kind: string, data: { [string]: any })
	vfx:FireAllClients(kind, data)
end

return ServerNet
