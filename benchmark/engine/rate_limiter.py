"""Per-vendor rate limiting using asyncio semaphores."""
import asyncio
from benchmark.config import RATE_LIMITS


class RateLimiter:
    """Manages concurrent request limits per vendor."""

    def __init__(self, rate_limits: dict = None):
        self._limits = rate_limits or RATE_LIMITS
        self._semaphores = {
            vendor: asyncio.Semaphore(limit)
            for vendor, limit in self._limits.items()
        }

    def get(self, vendor: str) -> asyncio.Semaphore:
        """Get the semaphore for a vendor. Creates one with default limit if unknown."""
        if vendor not in self._semaphores:
            self._semaphores[vendor] = asyncio.Semaphore(10)
        return self._semaphores[vendor]
