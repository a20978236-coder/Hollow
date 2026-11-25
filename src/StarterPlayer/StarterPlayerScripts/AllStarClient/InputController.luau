--[[
	All-Star :: InputController (client ModuleScript)

	Maps keyboard, mouse and gamepad to the same action callbacks the touch
	HUD uses (see Config.Keybinds). Touch input is handled by HUD buttons.
	Ignores input the game already processed (typing in chat, clicking UI).
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local Shared = ReplicatedStorage:WaitForChild("AllStar")
local Config = require(Shared:WaitForChild("Config"))

local InputController = {}

local KEYS = Config.Keybinds

local function matches(list: { Enum.KeyCode }, keyCode: Enum.KeyCode): boolean
	return table.find(list, keyCode) ~= nil
end

export type Actions = {
	toggleFlight: () -> (),
	beginBlast: (fromTouch: boolean) -> (),
	releaseBlast: () -> (),
	land: () -> (),
	setVertical: (source: string, value: number) -> (),
}

function InputController.start(actions: Actions): { RBXScriptConnection }
	local connections = {}

	table.insert(
		connections,
		UserInputService.InputBegan:Connect(function(input: InputObject, processed: boolean)
			if processed then
				return
			end
			local key = input.KeyCode
			if input.UserInputType == Enum.UserInputType.MouseButton1 then
				if KEYS.BlastMouse then
					actions.beginBlast(false)
				end
			elseif matches(KEYS.ToggleFlight, key) then
				actions.toggleFlight()
			elseif matches(KEYS.Blast, key) then
				actions.beginBlast(false)
			elseif matches(KEYS.Land, key) then
				actions.land()
			elseif matches(KEYS.Up, key) then
				actions.setVertical("keyUp", 1)
			elseif matches(KEYS.Down, key) then
				actions.setVertical("keyDown", -1)
			end
		end)
	)

	-- Releases are handled even if `processed` is true, so a key/button can
	-- never get "stuck" down because focus moved to the UI mid-hold.
	table.insert(
		connections,
		UserInputService.InputEnded:Connect(function(input: InputObject)
			local key = input.KeyCode
			if input.UserInputType == Enum.UserInputType.MouseButton1 then
				if KEYS.BlastMouse then
					actions.releaseBlast()
				end
			elseif matches(KEYS.Blast, key) then
				actions.releaseBlast()
			elseif matches(KEYS.Up, key) then
				actions.setVertical("keyUp", 0)
			elseif matches(KEYS.Down, key) then
				actions.setVertical("keyDown", 0)
			end
		end)
	)

	return connections
end

return InputController
