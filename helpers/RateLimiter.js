class RateLimiter {
    constructor(maxRequests = 10, timeWindow = 60000) { // 10 requests per 60 seconds
        this.maxRequests = maxRequests;
        this.timeWindow = timeWindow;
        this.requests = [];
    }

    async waitForSlot() {
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
        
        // Record this request
        this.requests.push(Date.now());
        
        // Add a small delay between requests for good measure (6+ seconds between requests)
        const minDelay = Math.ceil(this.timeWindow / this.maxRequests) + 500; // ~6.5 seconds
        console.log(`Waiting ${minDelay}ms before making request...`);
        await new Promise(resolve => setTimeout(resolve, minDelay));
    }
}
export default RateLimiter