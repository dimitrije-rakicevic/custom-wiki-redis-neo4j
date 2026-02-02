export class WikiService {
    constructor(apiUrl, authService) {
        this.apiUrl = apiUrl;
        this.authService = authService;
    }

    async getMyWikis() {
        const response = await fetch(`${this.apiUrl}/wiki/my`, {
            headers: this.authService.getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to fetch wikis');
        const wikis = await response.json();
        console.log(wikis)
        
        return {
            owned: wikis.filter(w => w.isOwner),
            subscribed: wikis.filter(w => !w.isOwner)
        };
    }

    async getWiki(wikiId) {
        const response = await fetch(`${this.apiUrl}/wiki/${wikiId}`, {
            headers: this.authService.getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to fetch wiki');
        return await response.json();
    }

    async createWiki(name, description, isPrivate = false) {
        const response = await fetch(`${this.apiUrl}/wiki`, {
            method: 'POST',
            headers: this.authService.getAuthHeaders(),
            body: JSON.stringify({ name, description, isPrivate })
        });

        if (!response.ok) throw new Error('Failed to create wiki');
        return await response.json();
    }

    async updateWiki(wikiId, name, description, isPrivate) {
        const response = await fetch(`${this.apiUrl}/wiki/${wikiId}`, {
            method: 'PUT',
            headers: this.authService.getAuthHeaders(),
            body: JSON.stringify({ name, description, isPrivate })
        });

        if (!response.ok) throw new Error('Failed to update wiki');
        return await response.json();
    }

    async deleteWiki(wikiId) {
        const response = await fetch(`${this.apiUrl}/wiki/${wikiId}`, {
            method: 'DELETE',
            headers: this.authService.getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to delete wiki');
        return await response.json();
    }

    async subscribeToWiki(wikiId) {
        const response = await fetch(`${this.apiUrl}/wiki/${wikiId}/subscribe`, {
            method: 'POST',
            headers: this.authService.getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to subscribe');
        return await response.json();
    }

    async unsubscribeFromWiki(wikiId) {
        const response = await fetch(`${this.apiUrl}/wiki/${wikiId}/unsubscribe`, {
            method: 'DELETE',
            headers: this.authService.getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to unsubscribe');
        return await response.json();
    }

    async searchWikis(query) {
        const response = await fetch(`${this.apiUrl}/wiki/search?query=${encodeURIComponent(query)}`, {
            headers: this.authService.getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to search wikis');
        return await response.json();
    }

    async getPages(wikiId) {
        const response = await fetch(`${this.apiUrl}/wiki/${wikiId}/pages`, {
            headers: this.authService.getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to fetch pages');
        return await response.json();
    }

    async getPage(wikiId, pageId) {
        const response = await fetch(`${this.apiUrl}/wiki/${wikiId}/pages/${pageId}`, {
            headers: this.authService.getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to fetch page');
        return await response.json();
    }

    async createPage(wikiId, title, content) {
        const response = await fetch(`${this.apiUrl}/wiki/${wikiId}/pages`, {
            method: 'POST',
            headers: this.authService.getAuthHeaders(),
            body: JSON.stringify({ title, content })
        });

        if (!response.ok) throw new Error('Failed to create page');
        return await response.json();
    }

    async updatePage(wikiId, pageId, title, content) {
        const response = await fetch(`${this.apiUrl}/wiki/${wikiId}/pages/${pageId}`, {
            method: 'PUT',
            headers: this.authService.getAuthHeaders(),
            body: JSON.stringify({ title, content })
        });

        if (!response.ok) throw new Error('Failed to update page');
        return await response.json();
    }

    async deletePage(wikiId, pageId) {
        const response = await fetch(`${this.apiUrl}/wiki/${wikiId}/pages/${pageId}`, {
            method: 'DELETE',
            headers: this.authService.getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to delete page');
        return await response.json();
    }

    async createRelationship(wikiId, fromPageId, toPageId, relationType, customLabel = null, isBidirectional = false) {
        const response = await fetch(`${this.apiUrl}/wiki/${wikiId}/pages/relationships`, {
            method: 'POST',
            headers: this.authService.getAuthHeaders(),
            body: JSON.stringify({ fromPageId, toPageId, relationType, customLabel, isBidirectional })
        });

        if (!response.ok) throw new Error('Failed to create relationship');
        return await response.json();
    }

    async getPageRelationships(wikiId, pageId) {
        const response = await fetch(`${this.apiUrl}/wiki/${wikiId}/pages/${pageId}/relationships`, {
            headers: this.authService.getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to get relationships');
        return await response.json();
    }

    async deleteRelationship(wikiId, fromPageId, toPageId, relationType) {
        const response = await fetch(
            `${this.apiUrl}/wiki/${wikiId}/pages/relationships?fromPageId=${fromPageId}&toPageId=${toPageId}&relationType=${relationType}`, {
            method: 'DELETE',
            headers: this.authService.getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to delete relationship');
        return await response.json();
    }

    async getChatHistory(wikiId, count = 50) {
        const response = await fetch(`${this.apiUrl}/chat/${wikiId}/history?count=${count}`, {
            headers: this.authService.getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to fetch chat history');
        return await response.json();
    }

    async sendMessage(wikiId, message) {
        const response = await fetch(`${this.apiUrl}/chat/${wikiId}/message`, {
            method: 'POST',
            headers: this.authService.getAuthHeaders(),
            body: JSON.stringify({ message })
        });

        if (!response.ok) throw new Error('Failed to send message');
        return await response.json();
    }

    async setTyping(wikiId) {
        const response = await fetch(`${this.apiUrl}/chat/${wikiId}/typing`, {
            method: 'POST',
            headers: this.authService.getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to set typing');
        return await response.json();
    }

    async getTypingUsers(wikiId) {
        const response = await fetch(`${this.apiUrl}/chat/${wikiId}/typing`, {
            headers: this.authService.getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to get typing users');
        return await response.json();
    }

    async getTrendingWikis(count = 10) {
        const response = await fetch(`${this.apiUrl}/wiki/trending?count=${count}`, {
            headers: this.authService.getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to fetch trending wikis');
        return await response.json();
    }

    async getMostViewedWikis(count = 10) {
        const response = await fetch(`${this.apiUrl}/wiki/stats/most-viewed?count=${count}`, {
            headers: this.authService.getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to fetch most viewed wikis');
        return await response.json();
    }

    async getOnlineUsers(wikiId) {
        const response = await fetch(`${this.apiUrl}/chat/${wikiId}/online`, {
            headers: this.authService.getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to fetch online users');
        return await response.json();
    }
}