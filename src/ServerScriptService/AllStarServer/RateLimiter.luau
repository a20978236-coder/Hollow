--[[
	All-Star :: RateLimiter (server ModuleScript)

	Per-player token bucket. Each remote request costs one token; tokens refill
	at `rate` per second up to `burst`. Requests over the limit are dropped
	silently, which stops remote-spam exploits from burning server CPU.
]]

local RateLimiter = {}
RateLimiter.__index = RateLimiter

type Bucket = { tokens: number, last: number }

export type RateLimiter = typeof(setmetatable(
	{} :: { _rate: number, _burst: number, _buckets: { [Player]: Bucket } },
	RateLimiter
))

function RateLimiter.new(rate: number, burst: number): RateLimiter
	return setmetatable({ _rate = rate, _burst = burst, _buckets = {} }, RateLimiter)
end

function RateLimiter.Allow(self: RateLimiter, player: Player, cost: number?): boolean
	local now = os.clock()
	local bucket = self._buckets[player]
	if not bucket then
		bucket = { tokens = self._burst, last = now }
		self._buckets[player] = bucket
	end
	bucket.tokens = math.min(self._burst, bucket.tokens + (now - bucket.last) * self._rate)
	bucket.last = now
	local price = cost or 1
	if bucket.tokens < price then
		return false
	end
	bucket.tokens -= price
	return true
end

function RateLimiter.Remove(self: RateLimiter, player: Player)
	self._buckets[player] = nil
end

return RateLimiter
