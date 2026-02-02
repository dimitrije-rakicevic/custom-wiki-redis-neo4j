import { AuthService } from './services/AuthService.js';
import { WikiService } from './services/WikiService.js';
import { AuthView } from './views/AuthView.js';
import { WikiListView } from './views/WikiListView.js';
import { WikiDetailView } from './views/WikiDetailView.js';

export class CustomWiki {
    constructor(apiUrl) {
        this.apiUrl = apiUrl;
        this.authService = new AuthService(apiUrl);
        this.wikiService = new WikiService(apiUrl, this.authService);
        
        this.container = null;
        this.currentView = null;
    }

    render() {
        this.container = document.createElement('div');
        this.container.className = 'app-container';
        document.body.appendChild(this.container);

        if (this.authService.isAuthenticated()) {
            this.showWikiList();
        } else {
            this.showAuth();
        }
    }

    showAuth() {
        this.clearContainer();
        this.currentView = new AuthView(this.container, this.authService, () => {
            this.showWikiList();
        });
        this.currentView.render();
    }

    showWikiList() {
        this.clearContainer();
        this.currentView = new WikiListView(this.container, this.wikiService, (wikiId) => {
            this.showWikiDetail(wikiId);
        }, () => {
            this.logout();
        });
        this.currentView.render();
    }

    showWikiDetail(wikiId) {
        this.clearContainer();
        this.currentView = new WikiDetailView(this.container, this.wikiService, wikiId, () => {
            this.showWikiList();
        });
        this.currentView.render();
    }

    logout() {
        this.authService.logout();
        this.showAuth();
    }

    clearContainer() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}