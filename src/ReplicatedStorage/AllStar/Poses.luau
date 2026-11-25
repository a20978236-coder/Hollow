--[[
	All-Star :: Poses (ModuleScript, ReplicatedStorage.AllStar.Poses) — CLIENT ONLY

	Procedural R15 poses written onto Motor6D.Transform, so the kit works
	without any uploaded animation assets. Every client applies poses to every
	All-Star character it sees (driven by replicated attributes and the Vfx
	remote), so everybody sees the flight pose, the charging arm and the
	superhero landing.

	If you upload real animations, put their IDs in Config.Animations; the
	controllers will play those as well (poses still blend on top).

	NOTE: joint angles below are hand-authored estimates. They have NOT been
	checked visually in Roblox Studio — tune them in POSES if a pose looks off.

	Joint frame convention (R15 C0 frames are axis-aligned with the body):
	  +X right, +Y up, +Z back.
	  Hips/Shoulders: +X rotation swings the limb FORWARD.
	  Knees/Elbows:   -X rotation bends the lower limb BACKWARD (knee bend).
	  Root/Waist:     -X rotation leans FORWARD.
]]

local RunService = game:GetService("RunService")

local Poses = {}

type JointPose = { [string]: CFrame } -- joint (Motor6D) name -> target Transform

local rad = math.rad

local POSES: { [string]: JointPose } = {
	Flight = {
		RightShoulder = CFrame.Angles(rad(160), 0, rad(8)),
		RightElbow = CFrame.Angles(rad(-5), 0, 0),
		LeftShoulder = CFrame.Angles(rad(-15), 0, rad(-12)),
		LeftElbow = CFrame.Angles(rad(-20), 0, 0),
		RightHip = CFrame.Angles(rad(-8), 0, 0),
		RightKnee = CFrame.Angles(rad(-10), 0, 0),
		LeftHip = CFrame.Angles(rad(12), 0, 0),
		LeftKnee = CFrame.Angles(rad(-45), 0, 0),
		LeftAnkle = CFrame.Angles(rad(-25), 0, 0),
		RightAnkle = CFrame.Angles(rad(-25), 0, 0),
	},
	Charge = {
		RightShoulder = CFrame.Angles(rad(90), 0, rad(-5)),
		RightElbow = CFrame.Angles(rad(0), 0, 0),
		RightWrist = CFrame.Angles(rad(-20), 0, 0),
		LeftShoulder = CFrame.Angles(rad(70), 0, rad(15)),
		LeftElbow = CFrame.Angles(rad(-40), 0, 0),
	},
	Landing = {
		Root = CFrame.new(0, -1.35, 0) * CFrame.Angles(rad(-20), 0, 0),
		Waist = CFrame.Angles(rad(-18), 0, 0),
		Neck = CFrame.Angles(rad(22), 0, 0),
		LeftHip = CFrame.Angles(rad(80), 0, rad(-6)),
		LeftKnee = CFrame.Angles(rad(-85), 0, 0),
		LeftAnkle = CFrame.Angles(rad(10), 0, 0),
		RightHip = CFrame.Angles(rad(-5), 0, rad(4)),
		RightKnee = CFrame.Angles(rad(-95), 0, 0),
		RightAnkle = CFrame.Angles(rad(-35), 0, 0),
		RightShoulder = CFrame.Angles(rad(25), 0, rad(8)),
		RightElbow = CFrame.Angles(rad(-5), 0, 0),
		LeftShoulder = CFrame.Angles(rad(-40), 0, rad(-45)),
		LeftElbow = CFrame.Angles(rad(-20), 0, 0),
	},
}

-- Higher priority is applied later and wins on shared joints.
local PRIORITY = { Flight = 1, Charge = 2, Landing = 3 }

type Entry = {
	name: string,
	weight: number,
	target: number, -- weight we are blending toward
	fadeSpeed: number, -- weight units per second
	expiresAt: number?,
}

type CharacterRecord = {
	motors: { [string]: Motor6D },
	entries: { [string]: Entry },
	written: { [Motor6D]: CFrame },
}

local records: { [Model]: CharacterRecord } = {}
local connection: RBXScriptConnection? = nil

local function collectMotors(character: Model): { [string]: Motor6D }
	local motors = {}
	for _, descendant in character:GetDescendants() do
		if descendant:IsA("Motor6D") then
			motors[descendant.Name] = descendant
		end
	end
	return motors
end

local function getRecord(character: Model): CharacterRecord
	local record = records[character]
	if not record then
		record = { motors = collectMotors(character), entries = {}, written = {} }
		records[character] = record
		character.Destroying:Connect(function()
			records[character] = nil
		end)
	end
	return record
end

local function step(dt: number)
	local now = os.clock()
	for character, record in records do
		if not character.Parent then
			records[character] = nil
			continue
		end

		-- Advance weights, collect active entries sorted by priority.
		local active: { Entry } = {}
		for name, entry in record.entries do
			if entry.expiresAt and now >= entry.expiresAt then
				entry.target = 0
				entry.expiresAt = nil
			end
			local delta = entry.fadeSpeed * dt
			if entry.weight < entry.target then
				entry.weight = math.min(entry.target, entry.weight + delta)
			else
				entry.weight = math.max(entry.target, entry.weight - delta)
			end
			if entry.weight <= 0 and entry.target <= 0 then
				record.entries[name] = nil
			else
				table.insert(active, entry)
			end
		end

		if #active == 0 then
			table.clear(record.written)
			continue
		end
		table.sort(active, function(a, b)
			return (PRIORITY[a.name] or 0) < (PRIORITY[b.name] or 0)
		end)

		-- Blend each touched joint once.
		local results: { [Motor6D]: CFrame } = {}
		for _, entry in active do
			for jointName, target in POSES[entry.name] do
				local motor = record.motors[jointName]
				if not motor or not motor.Parent then
					continue
				end
				local base = results[motor]
				if not base then
					-- If the animator did not overwrite Transform since our last
					-- write, start from rest instead of compounding our own pose.
					local current = motor.Transform
					base = if record.written[motor] == current then CFrame.identity else current
				end
				results[motor] = (base :: CFrame):Lerp(target, entry.weight)
			end
		end
		table.clear(record.written)
		for motor, value in results do
			motor.Transform = value
			record.written[motor] = value
		end
	end
end

local function ensureRunning()
	if connection then
		return
	end
	assert(RunService:IsClient(), "Poses runs on the client only")
	-- PreSimulation runs after the Animator has written this frame's Transforms.
	connection = RunService.PreSimulation:Connect(step)
end

-- Hold a pose on/off (flight, charge).
function Poses.setHeld(character: Model, name: string, held: boolean, fadeTime: number?)
	assert(POSES[name], "Unknown pose " .. name)
	ensureRunning()
	local record = getRecord(character)
	local entry = record.entries[name]
	local speed = 1 / math.max(fadeTime or 0.2, 0.01)
	if held then
		if not entry then
			-- Refresh joints: the record may predate the rig finishing loading,
			-- and ApplyDescription can rebuild Motor6Ds.
			record.motors = collectMotors(character)
			entry = { name = name, weight = 0, target = 1, fadeSpeed = speed }
			record.entries[name] = entry
		end
		entry.target = 1
		entry.fadeSpeed = speed
		entry.expiresAt = nil
	elseif entry then
		entry.target = 0
		entry.fadeSpeed = speed
	end
end

-- Play a pose once for `duration` seconds (landing).
function Poses.play(character: Model, name: string, duration: number, fadeTime: number?)
	Poses.setHeld(character, name, true, fadeTime or 0.08)
	local entry = getRecord(character).entries[name]
	entry.weight = 1 -- snap in: landings are an impact
	entry.expiresAt = os.clock() + duration
	entry.fadeSpeed = 1 / 0.3
end

-- Call when a character respawns so Motor6D references are refreshed.
function Poses.forget(character: Model)
	records[character] = nil
end

return Poses
