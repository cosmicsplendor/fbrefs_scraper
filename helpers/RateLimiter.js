class RateLimiter {
    constructor(maxRequests = 10, timeWindow = 60000) { // 10 requests per 60 seconds
        this.maxRequests = maxRequests;
        this.timeWindow = timeWindow;
        this.requests = [];
        this.lastRequestTime = 0;
    }

    async executeWithRateLimit(requestFn) {
        const now = Date.now();
        
        // Remove requests older than the time window
        this.requests = this.requests.filter(timestamp => now - timestamp < this.timeWindow);
        
        // If we're at the limit, wait until we can make another request
        if (this.requests.length >= this.maxRequests) {
            const oldestRequest = Math.min(...this.requests);
            const waitTime = this.timeWindow - (now - oldestRequest) + 100; // Add 100ms buffer
            
            console.log(`Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)} seconds before next request...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // Clean up again after waiting
            const newNow = Date.now();
            this.requests = this.requests.filter(timestamp => newNow - timestamp < this.timeWindow);
        }
        
        // Calculate minimum time between request starts (distributed evenly)
        const minInterval = Math.ceil(this.timeWindow / this.maxRequests);
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < minInterval) {
            const additionalWait = minInterval - timeSinceLastRequest;
            console.log(`Waiting ${additionalWait}ms to maintain minimum interval...`);
            await new Promise(resolve => setTimeout(resolve, additionalWait));
        }
        
        // Record when we START the request
        const requestStartTime = Date.now();
        this.lastRequestTime = requestStartTime;
        console.log(`Starting request...`);
        
        try {
            // Execute the actual request
            const result = await requestFn();
            
            // Record when the request COMPLETES (this is what counts for rate limiting)
            const requestEndTime = Date.now();
            this.requests.push(requestEndTime);
            
            const duration = requestEndTime - requestStartTime;
            console.log(`✓ Request completed in ${duration}ms`);
            
            return result;
        } catch (error) {
            // Still record the request even if it failed
            const requestEndTime = Date.now();
            this.requests.push(requestEndTime);
            
            const duration = requestEndTime - requestStartTime;
            console.log(`✗ Request failed after ${duration}ms`);
            throw error;
        }
    }

    // Legacy method for backward compatibility (but recommend using executeWithRateLimit)
    async waitForSlot() {
        const now = Date.now();
        
        // Remove requests older than the time window
        this.requests = this.requests.filter(timestamp => now - timestamp < this.timeWindow);
        
        // If we're at the limit, wait until we can make another request
        if (this.requests.length >= this.maxRequests) {
            const oldestRequest = Math.min(...this.requests);
            const waitTime = this.timeWindow - (now - oldestRequest) + 100;
            
            console.log(`Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)} seconds before next request...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            const newNow = Date.now();
            this.requests = this.requests.filter(timestamp => newNow - timestamp < this.timeWindow);
        }
        
        // Calculate minimum time between request starts
        const minInterval = Math.ceil(this.timeWindow / this.maxRequests);
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < minInterval) {
            const additionalWait = minInterval - timeSinceLastRequest;
            console.log(`Waiting ${additionalWait}ms to maintain minimum interval...`);
            await new Promise(resolve => setTimeout(resolve, additionalWait));
        }
        
        this.lastRequestTime = Date.now();
        this.requests.push(Date.now()); // For legacy compatibility, record start time
    }
}

module.exports = RateLimiter;