--[[
	All-Star :: CooldownTracker (ModuleScript, ReplicatedStorage.AllStar.CooldownTracker)

	Reusable keyed cooldown timer. The server keeps one per player (authoritative);
	the client keeps one for HUD display and to avoid sending requests that would
	obviously be rejected.

	    local cd = CooldownTracker.new()
	    if cd:IsReady("Blast") then cd:Start("Blast", 0.5) end
	    local remaining, duration = cd:Get("Blast")
]]

local CooldownTracker = {}
CooldownTracker.__index = CooldownTracker

export type CooldownTracker = typeof(setmetatable(
	{} :: {
		_ends: { [string]: number },
		_durations: { [string]: number },
		_clock: () -> number,
	},
	CooldownTracker
))

function CooldownTracker.new(clock: (() -> number)?): CooldownTracker
	return setmetatable({
		_ends = {},
		_durations = {},
		_clock = clock or os.clock,
	}, CooldownTracker)
end

function CooldownTracker.IsReady(self: CooldownTracker, key: string): boolean
	return self._clock() >= (self._ends[key] or 0)
end

function CooldownTracker.Start(self: CooldownTracker, key: string, duration: number)
	self._ends[key] = self._clock() + duration
	self._durations[key] = duration
end

-- Returns remaining seconds and the full duration of the last Start (for progress bars).
function CooldownTracker.Get(self: CooldownTracker, key: string): (number, number)
	local remaining = math.max(0, (self._ends[key] or 0) - self._clock())
	return remaining, self._durations[key] or 0
end

function CooldownTracker.Reset(self: CooldownTracker, key: string)
	self._ends[key] = nil
	self._durations[key] = nil
end

function CooldownTracker.Clear(self: CooldownTracker)
	table.clear(self._ends)
	table.clear(self._durations)
end

return CooldownTracker
