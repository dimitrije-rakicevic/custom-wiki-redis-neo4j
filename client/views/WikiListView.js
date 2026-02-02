export class WikiListView {
    constructor(container, wikiService, onWikiClick, onLogout) {
        this.container = container;
        this.wikiService = wikiService;
        this.onWikiClick = onWikiClick;
        this.onLogout = onLogout;
        this.ownedWikis = [];
        this.subscribedWikis = [];
    }

    async render() {
        const mainContainer = document.createElement('div');
        mainContainer.className = 'wiki-list-container';
        this.container.appendChild(mainContainer);

        this.renderHeader(mainContainer);
        await this.renderWikiSections(mainContainer);
    }

    renderHeader(parent) {
        const header = document.createElement('div');
        header.className = 'header';

        const title = document.createElement('h1');
        title.innerHTML = 'Custom<span>Wiki</span>';
        header.appendChild(title);

        const rightSection = document.createElement('div');
        rightSection.className = 'header-right';

        const createBtn = document.createElement('button');
        createBtn.textContent = 'Create Wiki';
        createBtn.className = 'btn-primary';
        createBtn.onclick = () => this.showCreateWikiForm();
        rightSection.appendChild(createBtn);

        const logoutBtn = document.createElement('button');
        logoutBtn.textContent = 'Logout';
        logoutBtn.className = 'btn-secondary';
        logoutBtn.onclick = () => this.onLogout();
        rightSection.appendChild(logoutBtn);

        header.appendChild(rightSection);
        parent.appendChild(header);
    }

    async renderWikiSections(parent) {
        const sectionsContainer = document.createElement('div');
        sectionsContainer.className = 'sections-container';
        parent.appendChild(sectionsContainer);

        try {
            const data = await this.wikiService.getMyWikis();

            this.ownedWikis = data.owned;
            this.subscribedWikis = data.subscribed;

            this.subscribedWikiIds = new Set(this.subscribedWikis.map(w => w.id));
            this.ownedWikiIds = new Set(this.ownedWikis.map(w => w.id));
            
            if (this.ownedWikis.length > 0) {
                this.renderSection(sectionsContainer, 'My Wikis', this.ownedWikis, true);
            }

            if (this.subscribedWikis.length > 0) {
                this.renderSection(sectionsContainer, 'Subscribed Wikis', this.subscribedWikis, false);
            }

            this.renderDiscoverSection(sectionsContainer);
            await this.renderTrendingSection(sectionsContainer);
            await this.renderMostViewedSection(sectionsContainer);

        } catch (error) {
            sectionsContainer.innerHTML = `<p class="error">Failed to load wikis: ${error.message}</p>`;
        }
    }

    renderSection(parent, title, wikis, showManage) {
        const section = document.createElement('div');
        section.className = 'wiki-section';

        const header = document.createElement('div');
        header.className = 'section-header';

        const titleEl = document.createElement('h2');
        titleEl.textContent = title;
        header.appendChild(titleEl);

        section.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'wiki-grid';

        wikis.forEach(wiki => {
            const card = this.createWikiCard(wiki, showManage);
            grid.appendChild(card);
        });

        section.appendChild(grid);
        parent.appendChild(section);
    }

    createWikiCard(wiki, showManage) {
        const card = document.createElement('div');
        card.className = 'wiki-card';

        const cardContent = document.createElement('div');
        cardContent.onclick = () => this.onWikiClick(wiki.id);

        const name = document.createElement('h3');
        name.textContent = wiki.name;
        cardContent.appendChild(name);

        const description = document.createElement('p');
        description.textContent = wiki.description;
        description.className = 'wiki-description';
        cardContent.appendChild(description);

        const meta = document.createElement('div');
        meta.className = 'wiki-meta';
        
        const ownerBadge = document.createElement('span');
        ownerBadge.className = wiki.isOwner ? 'badge-owner' : 'badge-member';
        ownerBadge.textContent = wiki.isOwner ? 'Owner' : 'Member';
        meta.appendChild(ownerBadge);

        console.log(wiki)

        const stats = document.createElement('span');
        stats.textContent = ` ${wiki.subscriberCount} subscribers, ${wiki.pageCount || 0} pages`;
        meta.appendChild(stats);

        cardContent.appendChild(meta);
        card.appendChild(cardContent);

        if (showManage && wiki.isOwner) {
            const manageBtn = document.createElement('button');
            manageBtn.textContent = 'Manage';
            manageBtn.className = 'btn-manage';
            manageBtn.onclick = (e) => {
                e.stopPropagation();
                this.showManageMenu(wiki);
            };
            card.appendChild(manageBtn);
        }
        return card;
    }

    async renderDiscoverSection(parent) {
        const section = document.createElement('div');
        section.className = 'wiki-section';

        const header = document.createElement('div');
        header.className = 'section-header';

        const title = document.createElement('h2');
        title.textContent = 'Discover';
        header.appendChild(title);

        section.appendChild(header);

        const searchBar = document.createElement('div');
        searchBar.className = 'search-bar';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search public wikis...';
        searchInput.className = 'search-input';
        searchInput.oninput = (e) => this.handleSearch(e.target.value);
        searchBar.appendChild(searchInput);

        section.appendChild(searchBar);

        const resultsGrid = document.createElement('div');
        resultsGrid.className = 'wiki-grid';
        resultsGrid.id = 'discover-results';
        resultsGrid.innerHTML = '<p class="search-hint">Search for public wikis to discover new content</p>';
        section.appendChild(resultsGrid);

        parent.appendChild(section);
    }

    async handleSearch(query) {
        const resultsContainer = document.getElementById('discover-results');

        if (!query.trim()) {
            resultsContainer.innerHTML = '<p class="search-hint">Search for public wikis to discover new content</p>';
            return;
        }

        try {
            resultsContainer.innerHTML = '<p class="loading">Searching...</p>';
            const results = await this.wikiService.searchWikis(query);

            if (results.length === 0) {
                resultsContainer.innerHTML = '<p class="no-results">No public wikis found</p>';
                return;
            }

            resultsContainer.innerHTML = '';
            results.forEach(wiki => {
                const card = this.createDiscoverCard(wiki);
                resultsContainer.appendChild(card);
            });
        } catch (error) {
            resultsContainer.innerHTML = `<p class="error">Search failed: ${error.message}</p>`;
        }
    }

    createDiscoverCard(wiki) {
        const card = document.createElement('div');
        card.className = 'wiki-card discover-card';

        const name = document.createElement('h3');
        name.textContent = wiki.name;
        card.appendChild(name);

        const description = document.createElement('p');
        description.textContent = wiki.description;
        description.className = 'wiki-description';
        card.appendChild(description);

        const meta = document.createElement('div');
        meta.className = 'wiki-meta';
        meta.textContent = `By ${wiki.ownerUsername}, ${wiki.subscriberCount} subscribers`;
        card.appendChild(meta);

        const btnContainer = document.createElement('div');
        btnContainer.className = 'card-actions';

        const viewBtn = document.createElement('button');
        viewBtn.textContent = 'View';
        viewBtn.className = 'btn-secondary btn-small';
        viewBtn.onclick = () => this.onWikiClick(wiki.id);
        btnContainer.appendChild(viewBtn);

        const currentUsername = JSON.parse(localStorage.getItem('user')).username;
        const isOwner = wiki.ownerUsername === currentUsername;

        if (!wiki.isSubscribed && !isOwner) {
            // Subscribe button for non-subscribers
            const subscribeBtn = document.createElement('button');
            subscribeBtn.textContent = 'Subscribe';
            subscribeBtn.className = 'btn-primary btn-small';
            subscribeBtn.onclick = async () => {
                try {
                    await this.wikiService.subscribeToWiki(wiki.id);
                    subscribeBtn.textContent = 'Subscribed';
                    subscribeBtn.disabled = true;
                    
                    this.container.innerHTML = '';
                    this.render();
                } catch (error) {
                    alert('Failed to subscribe: ' + error.message);
                }
            };
            btnContainer.appendChild(subscribeBtn);
        } else if (wiki.isSubscribed && !isOwner) {
            // Unsubscribe button for subscribers (but not owners)
            const unsubscribeBtn = document.createElement('button');
            unsubscribeBtn.textContent = 'Subscribed';
            unsubscribeBtn.className = 'btn-subscribed btn-small';
            unsubscribeBtn.onclick = async () => {
                if (!confirm(`Unsubscribe from "${wiki.name}"?`)) return;
                try {
                    await this.wikiService.unsubscribeFromWiki(wiki.id);
                    // Refresh view
                    this.container.innerHTML = '';
                    this.render();
                } catch (error) {
                    alert('Failed to unsubscribe: ' + error.message);
                }
            };
            btnContainer.appendChild(unsubscribeBtn);
        } else if (isOwner) {
            // Owner badge (owners cannot unsubscribe)
            const ownerBadge = document.createElement('span');
            ownerBadge.textContent = 'Owner';
            ownerBadge.className = 'owner-badge';
            btnContainer.appendChild(ownerBadge);
        }

        card.appendChild(btnContainer);
        return card;
    }

    async renderTrendingSection(parent) {
        const section = document.createElement('div');
        section.className = 'wiki-section';

        const header = document.createElement('div');
        header.className = 'section-header';

        const title = document.createElement('h2');
        title.textContent = 'Trending (Last 7 Days)';
        header.appendChild(title);

        section.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'wiki-grid';
        section.appendChild(grid);

        try {
            const data = await this.wikiService.getTrendingWikis(6);
            const wikis = data.wikis || [];

            if (wikis.length === 0) {
                grid.innerHTML = '<p class="no-results">No trending wikis yet</p>';
            } else {
                wikis.forEach(wiki => {
                    const card = this.createDiscoverCard(wiki);
                    grid.appendChild(card);
                });
            }
        } catch (error) {
            grid.innerHTML = `<p class="error">Failed to load trending wikis</p>`;
        }

        parent.appendChild(section);
    }

    async renderMostViewedSection(parent) {
        const section = document.createElement('div');
        section.className = 'wiki-section';

        const header = document.createElement('div');
        header.className = 'section-header';

        const title = document.createElement('h2');
        title.textContent = 'Most Subscribers';
        header.appendChild(title);

        section.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'wiki-grid';
        section.appendChild(grid);

        try {
            const data = await this.wikiService.getMostViewedWikis(6);
            const wikis = data.wikis || [];

            if (wikis.length === 0) {
                grid.innerHTML = '<p class="no-results">No data available</p>';
            } else {
                wikis.forEach(wiki => {
                    const card = this.createDiscoverCard(wiki);
                    grid.appendChild(card);
                });
            }
        } catch (error) {
            grid.innerHTML = `<p class="error">Failed to load popular wikis</p>`;
        }

        parent.appendChild(section);
    }

    showManageMenu(wiki) {
        const modal = document.createElement('div');
        modal.className = 'modal';

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modal.appendChild(modalContent);

        const title = document.createElement('h2');
        title.textContent = `Manage: ${wiki.name}`;
        modalContent.appendChild(title);

        const options = [
            { text: 'Edit Wiki', action: () => this.showEditWikiForm(wiki) },
            { text: 'Delete Wiki', action: () => this.showDeleteConfirmation(wiki), danger: true }
        ];

        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.textContent = opt.text;
            btn.className = opt.danger ? 'btn-danger' : 'btn-secondary';
            btn.style.width = '100%';
            btn.style.marginBottom = '10px';
            btn.onclick = () => {
                document.body.removeChild(modal);
                opt.action();
            };
            modalContent.appendChild(btn);
        });

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.className = 'btn-secondary';
        closeBtn.style.width = '100%';
        closeBtn.onclick = () => document.body.removeChild(modal);
        modalContent.appendChild(closeBtn);

        document.body.appendChild(modal);
    }

    showEditWikiForm(wiki) {
        const modal = document.createElement('div');
        modal.className = 'modal';

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modal.appendChild(modalContent);

        const title = document.createElement('h2');
        title.textContent = 'Edit Wiki';
        modalContent.appendChild(title);

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Wiki Name';
        nameInput.className = 'auth-input';
        nameInput.value = wiki.name;
        modalContent.appendChild(nameInput);

        const descInput = document.createElement('textarea');
        descInput.placeholder = 'Description';
        descInput.className = 'auth-input';
        descInput.rows = 4;
        descInput.value = wiki.description || '';
        modalContent.appendChild(descInput);

        const privateCheckbox = document.createElement('div');
        privateCheckbox.className = 'checkbox-group';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'edit-private-checkbox';
        checkbox.checked = wiki.isPrivate || false;
        const label = document.createElement('label');
        label.htmlFor = 'edit-private-checkbox';
        label.textContent = 'Private Wiki';
        privateCheckbox.appendChild(checkbox);
        privateCheckbox.appendChild(label);
        modalContent.appendChild(privateCheckbox);

        const errorMsg = document.createElement('p');
        errorMsg.className = 'error';
        errorMsg.style.display = 'none';
        modalContent.appendChild(errorMsg);

        const btnContainer = document.createElement('div');
        btnContainer.className = 'modal-buttons';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save Changes';
        saveBtn.className = 'btn-primary';
        saveBtn.onclick = async () => {
            const name = nameInput.value.trim();
            if (!name) {
                errorMsg.textContent = 'Wiki name cannot be empty.';
                errorMsg.style.display = 'block';
                return;
            }

            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
            errorMsg.style.display = 'none';

            try {
                await this.wikiService.updateWiki(
                    wiki.id,
                    name,
                    descInput.value.trim(),
                    checkbox.checked
                );
                document.body.removeChild(modal);
                
                this.container.innerHTML = '';
                this.render();
            } catch (error) {
                errorMsg.textContent = 'Failed to save: ' + error.message;
                errorMsg.style.display = 'block';
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Changes';
            }
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'btn-secondary';
        cancelBtn.onclick = () => document.body.removeChild(modal);

        btnContainer.appendChild(saveBtn);
        btnContainer.appendChild(cancelBtn);
        modalContent.appendChild(btnContainer);

        document.body.appendChild(modal);
    }

    showDeleteConfirmation(wiki) {
        const modal = document.createElement('div');
        modal.className = 'modal';

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modal.appendChild(modalContent);

        const title = document.createElement('h2');
        title.textContent = 'Delete Wiki';
        modalContent.appendChild(title);

        const warning = document.createElement('p');
        warning.className = 'delete-warning';
        warning.innerHTML = 'Are you sure you want to delete this wiki?';
        modalContent.appendChild(warning);

        const errorMsg = document.createElement('p');
        errorMsg.className = 'error';
        errorMsg.style.display = 'none';
        modalContent.appendChild(errorMsg);

        const btnContainer = document.createElement('div');
        btnContainer.className = 'modal-buttons';

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete Wiki';
        deleteBtn.className = 'btn-danger';
        deleteBtn.onclick = async () => {
            deleteBtn.disabled = true;
            deleteBtn.textContent = 'Deleting...';
            errorMsg.style.display = 'none';

            try {
                await this.wikiService.deleteWiki(wiki.id);
                document.body.removeChild(modal);
                
                this.container.innerHTML = '';
                this.render();
            } catch (error) {
                errorMsg.textContent = 'Failed to delete: ' + error.message;
                errorMsg.style.display = 'block';
                deleteBtn.textContent = 'Delete Wiki';
            }
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'btn-secondary';
        cancelBtn.onclick = () => document.body.removeChild(modal);

        btnContainer.appendChild(deleteBtn);
        btnContainer.appendChild(cancelBtn);
        modalContent.appendChild(btnContainer);

        document.body.appendChild(modal);
    }

    showCreateWikiForm() {
        const modal = document.createElement('div');
        modal.className = 'modal';

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modal.appendChild(modalContent);

        const title = document.createElement('h2');
        title.textContent = 'Create New Wiki';
        modalContent.appendChild(title);

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Wiki Name';
        nameInput.className = 'auth-input';
        modalContent.appendChild(nameInput);

        const descInput = document.createElement('textarea');
        descInput.placeholder = 'Description';
        descInput.className = 'auth-input';
        descInput.rows = 4;
        modalContent.appendChild(descInput);

        const privateCheckbox = document.createElement('div');
        privateCheckbox.className = 'checkbox-group';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'private-checkbox';
        const label = document.createElement('label');
        label.htmlFor = 'private-checkbox';
        label.textContent = 'Private Wiki';
        privateCheckbox.appendChild(checkbox);
        privateCheckbox.appendChild(label);
        modalContent.appendChild(privateCheckbox);

        const btnContainer = document.createElement('div');
        btnContainer.className = 'modal-buttons';

        const createBtn = document.createElement('button');
        createBtn.textContent = 'Create';
        createBtn.className = 'btn-primary';
        createBtn.onclick = async () => {
            try {
                await this.wikiService.createWiki(
                    nameInput.value,
                    descInput.value,
                    checkbox.checked
                );
                document.body.removeChild(modal);
                this.container.innerHTML = '';
                this.render();
            } catch (error) {
                alert('Failed to create wiki: ' + error.message);
            }
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'btn-secondary';
        cancelBtn.onclick = () => document.body.removeChild(modal);

        btnContainer.appendChild(createBtn);
        btnContainer.appendChild(cancelBtn);
        modalContent.appendChild(btnContainer);

        document.body.appendChild(modal);
    }
}