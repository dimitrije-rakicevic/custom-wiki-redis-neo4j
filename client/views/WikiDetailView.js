import * as signalR from "https://esm.sh/@microsoft/signalr@10.0.0";

export class WikiDetailView {
    constructor(container, wikiService, wikiId, onBack) {
        this.container = container;
        this.wikiService = wikiService;
        this.wikiId = wikiId;
        this.onBack = onBack;
        this.wiki = null;
        this.pages = [];
        this.currentPage = null;
        this.chatPollInterval = null;
        this.signalRConnection = null;
        this.typingUsers = new Set();
    }

    async render() {
        const mainContainer = document.createElement('div');
        mainContainer.className = 'wiki-detail-wrapper';
        this.container.appendChild(mainContainer);
  
        this.renderHeader(mainContainer);

        try {
            this.wiki = await this.wikiService.getWiki(this.wikiId);

            const user = JSON.parse(localStorage.getItem('user'));
            this.wiki.isOwner = this.wiki.ownerUsername === user.username;
            
            this.pages = await this.wikiService.getPages(this.wikiId);

            const layoutContainer = document.createElement('div');
            layoutContainer.className = 'wiki-detail-container';
            mainContainer.appendChild(layoutContainer);

            this.renderSidebar(layoutContainer);
            this.renderContent(layoutContainer);
            
            if (this.wiki.isSubscribed) {
                this.renderChat(layoutContainer);
                await this.startSignalR();
                this.loadChatHistory();
            } else {
                this.renderChatPlaceholder(layoutContainer);
            }
            
        } catch (error) {
            mainContainer.innerHTML += `<p class="error">Failed to load wiki: ${error.message}</p>`;
        }
    }

    renderHeader(parent) {
        if(parent.innerHTML) { parent.innerHTML='' }
        const header = document.createElement('div');
        header.className = 'header';

        const leftSection = document.createElement('div'); 
        leftSection.className = 'header-left';

        const backBtn = document.createElement('button');
        backBtn.textContent = '← Back';
        backBtn.className = 'btn-secondary';
        backBtn.onclick = () => {
            this.stopSignalR();
            this.onBack();
        };
        leftSection.appendChild(backBtn);
        const logo = document.createElement('h1');
        logo.innerHTML = 'Custom<span>Wiki</span>';
        logo.className = 'logo';
        leftSection.appendChild(logo);

        header.appendChild(leftSection);

        parent.appendChild(header);
    }

    renderSidebar(parent) {
        const sidebar = document.createElement('div');
        sidebar.className = 'wiki-sidebar';

        const pagesTitle = document.createElement('h3');
        pagesTitle.textContent = 'Pages';
        sidebar.appendChild(pagesTitle);

        const pagesList = document.createElement('div');
        pagesList.className = 'pages-list';
        pagesList.id = 'pages-list';
        sidebar.appendChild(pagesList);

        if (this.pages.length === 0) {
            pagesList.innerHTML = '<p class="no-pages">No pages yet</p>';
        } else {
            this.pages.forEach(page => {
                const pageItem = document.createElement('div');
                pageItem.className = 'page-list-item';
                pageItem.textContent = page.title;
                pageItem.dataset.pageId = page.id;
                pageItem.onclick = () => this.loadPage(page.id);
                pagesList.appendChild(pageItem);
            });

            this.loadPage(this.pages[0].id);
        }

        console.log(this.wiki.isOwner)
        if (this.wiki.isOwner) {
            const addPageBtn = document.createElement('button');
            addPageBtn.textContent = 'Add Page';
            addPageBtn.className = 'btn-primary';
            addPageBtn.onclick = () => this.showAddPageForm();
            sidebar.appendChild(addPageBtn);

            const manageBtn = document.createElement('button');
            manageBtn.textContent = 'Manage Wiki';
            manageBtn.className = 'btn-secondary';
            manageBtn.style.marginTop = '10px';
            manageBtn.onclick = () => this.showManageSection();
            sidebar.appendChild(manageBtn);
        }

        parent.appendChild(sidebar);
    }

    renderContent(parent) {
        const content = document.createElement('div');
        content.className = 'wiki-content';

        const wikiInfo = document.createElement('div');
        wikiInfo.className = 'wiki-info';

        const name = document.createElement('h1')
        name.className='wiki-name'
        name.textContent = this.wiki.name;
        wikiInfo.appendChild(name);

        const meta = document.createElement('div');
        meta.className = 'wiki-meta';
        meta.textContent = `Owner: ${this.wiki.ownerUsername}, ${this.wiki.subscriberCount} subscribers`;
        wikiInfo.appendChild(meta);

        const description = document.createElement('p');
        description.textContent = this.wiki.description;
        description.className = 'wiki-description';
        wikiInfo.appendChild(description);

        content.appendChild(wikiInfo);

        const pageContent = document.createElement('div');
        pageContent.className = 'page-content';
        pageContent.id = 'page-content';
        pageContent.innerHTML = '<p class="select-page">Select a page from the sidebar</p>';
        content.appendChild(pageContent);

        parent.appendChild(content);
    }

    renderChatPlaceholder(parent) {
        const chatPlaceholder = document.createElement('div');
        chatPlaceholder.className = 'wiki-chat chat-placeholder';

        const message = document.createElement('p');
        message.className = 'chat-placeholder-message';
        message.textContent = 'Join wiki to chat with other subscribers';
        chatPlaceholder.appendChild(message);

        const subscribeBtn = document.createElement('button');
        subscribeBtn.textContent = 'Subscribe to Wiki';
        subscribeBtn.className = 'btn-primary';
        subscribeBtn.onclick = async () => {
            try {
                await this.wikiService.subscribeToWiki(this.wikiId);
                this.container.innerHTML = '';
                this.render();
            } catch (error) {
                alert('Failed to subscribe: ' + error.message);
            }
        };
        chatPlaceholder.appendChild(subscribeBtn);

        parent.appendChild(chatPlaceholder);
    }

    renderChat(parent) {
        const chat = document.createElement('div');
        chat.className = 'wiki-chat';

        const chatTitle = document.createElement('h3');
        chatTitle.textContent = 'Chat';
        chat.appendChild(chatTitle);

        const messagesContainer = document.createElement('div');
        messagesContainer.className = 'chat-messages';
        messagesContainer.id = 'chat-messages';
        chat.appendChild(messagesContainer);

        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'typing-indicator';
        typingIndicator.id = 'typing-indicator';
        typingIndicator.style.display = 'none';
        chat.appendChild(typingIndicator);

        const inputContainer = document.createElement('div');
        inputContainer.className = 'chat-input-container';

        const messageInput = document.createElement('input');
        messageInput.type = 'text';
        messageInput.placeholder = 'Type a message...';
        messageInput.id = 'chat-input';
        messageInput.onkeypress = (e) => {
            if (e.key === 'Enter') this.sendMessage();
        };
        
        let typingTimeout;
        messageInput.oninput = () => {
            if (this.signalRConnection?.state === 'Connected') {
                this.signalRConnection.invoke('SendTyping', this.wikiId).catch(() => {});
            }
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
            }, 3000);
        };
        inputContainer.appendChild(messageInput);

        const sendBtn = document.createElement('button');
        sendBtn.textContent = 'Send';
        sendBtn.className = 'btn-primary';
        sendBtn.onclick = () => this.sendMessage();
        inputContainer.appendChild(sendBtn);

        chat.appendChild(inputContainer);

        const onlineSection = document.createElement('div');
        onlineSection.className = 'online-users-section';
        onlineSection.id = 'online-users-section';
        chat.appendChild(onlineSection);

        parent.appendChild(chat);

        this.updateOnlineUsers();
    }

    //SIGNALR
    async startSignalR() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('No auth token found');
                return;
            }

            this.signalRConnection = new signalR.HubConnectionBuilder()
                .withUrl('http://localhost:5073/chathub', {
                    accessTokenFactory: () => token
                })
                .withAutomaticReconnect()
                .build();

            this.signalRConnection.on('ReceiveMessage', (data) => {
                this.displayMessage(data);
            });

            this.signalRConnection.on('UserTyping', (data) => {
                this.handleUserTyping(data);
            });

            this.signalRConnection.on('UserJoined', (data) => {
                console.log('User joined:', data.username);
            });

            this.signalRConnection.on('UserLeft', (data) => {
                console.log('User left:', data.username);
                this.typingUsers.delete(data.userId);
                this.updateTypingIndicatorDisplay();
            });

            this.signalRConnection.on('OnlineCountUpdated', (count) => {
                this.updateOnlineUsers();
            });

            await this.signalRConnection.start();
            console.log('SignalR connected');

            await this.signalRConnection.invoke('JoinWiki', this.wikiId);

        } catch (error) {
            console.error('SignalR connection failed:', error);
            //http fallback
            this.startChatPolling();
        }
    }

    async stopSignalR() {
        if (this.signalRConnection) {
            try {
                await this.signalRConnection.invoke('LeaveWiki', this.wikiId);
                await this.signalRConnection.stop();
                console.log('SignalR disconnected');
            } catch (error) {
                console.error('Error stopping SignalR:', error);
            }
        }
        this.stopChatPolling();
    }

    handleUserTyping(data) {
        const currentUserId = JSON.parse(localStorage.getItem('user')).id;
        if (data.userId === currentUserId) return;

        this.typingUsers.add(data.username);
        this.updateTypingIndicatorDisplay();

        setTimeout(() => {
            this.typingUsers.delete(data.username);
            this.updateTypingIndicatorDisplay();
        }, 3000);
    }

    updateTypingIndicatorDisplay() {
        const indicator = document.getElementById('typing-indicator');
        if (!indicator) return;

        if (this.typingUsers.size === 0) {
            indicator.style.display = 'none';
        } else {
            indicator.style.display = 'block';
            const usernames = Array.from(this.typingUsers);
            const text = usernames.length === 1
                ? `${usernames[0]} is typing...`
                : `${usernames.length} people are typing...`;
            indicator.innerHTML = `<span class="typing-dots">${text}</span>`;
        }
    }

    //Load page

    async loadPage(pageId) {
        try {
            
            console.log(pageId)
            const page = await this.wikiService.getPage(this.wikiId, pageId);
            this.currentPage = page;


            const pageContent = document.getElementById('page-content');
            pageContent.innerHTML = '';

            const header = document.createElement('div');
            header.className = 'page-header';

            const title = document.createElement('h1');
            title.textContent = page.title;
            header.appendChild(title);

            if (this.wiki.isOwner) {
                const editBtn = document.createElement('button');
                editBtn.textContent = 'Edit';
                editBtn.className = 'btn-secondary btn-small';
                editBtn.onclick = () => this.showEditPageForm(page);
                header.appendChild(editBtn);
            }

            pageContent.appendChild(header);

            const content = document.createElement('div');
            content.className = 'page-text';
            content.innerHTML = this.renderMarkdown(page.content);
            pageContent.appendChild(content);

            await this.renderPageRelationships(pageContent, pageId);

            document.querySelectorAll('.page-list-item').forEach(item => {
                item.classList.remove('active');
                if (item.dataset.pageId === pageId) {
                    item.classList.add('active');
                }
            });
        } catch (error) {
            console.error('Failed to load page:', error);
        }
    }

    async renderPageRelationships(container, pageId) {
        try {
            const data = await this.wikiService.getPageRelationships(this.wikiId, pageId);
            
            if (!data.outgoing || data.outgoing.length === 0) {
                return;
            }

            const relSection = document.createElement('div');
            relSection.className = 'page-relationships';

            const relTitle = document.createElement('h3');
            relTitle.textContent = 'Relationships';
            relTitle.className = 'relationships-title';
            relSection.appendChild(relTitle);

            const relList = document.createElement('div');
            relList.className = 'relationships-list';

            data.outgoing.forEach(rel => {
                const relItem = document.createElement('div');
                relItem.className = 'relationship-item';

                const relLabel = document.createElement('span');
                relLabel.className = 'relationship-label';
                relLabel.textContent = rel.customLabel || rel.relationType;
                relItem.appendChild(relLabel);

                const relTarget = document.createElement('a');
                relTarget.className = 'relationship-target';
                relTarget.textContent = rel.toPageTitle;
                relTarget.href = '#';
                relTarget.onclick = (e) => {
                    e.preventDefault();
                    this.loadPage(rel.toPageId);
                };
                relItem.appendChild(relTarget);

                relList.appendChild(relItem);
            });

            relSection.appendChild(relList);
            container.appendChild(relSection);
        } catch (error) {
            console.error('Failed to load page relationships:', error);
        }
    }

    renderMarkdown(markdown) {
        return markdown
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>');
    }
    
    showAddPageForm() {
        const modal = document.createElement('div');
        modal.className = 'modal';

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modal.appendChild(modalContent);

        const title = document.createElement('h2');
        title.textContent = 'Add New Page';
        modalContent.appendChild(title);

        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.placeholder = 'Page Title';
        titleInput.className = 'auth-input';
        modalContent.appendChild(titleInput);

        const contentInput = document.createElement('textarea');
        contentInput.placeholder = 'Page Content (Markdown)';
        contentInput.className = 'auth-input';
        contentInput.rows = 10;
        modalContent.appendChild(contentInput);

        const btnContainer = document.createElement('div');
        btnContainer.className = 'modal-buttons';

        const createBtn = document.createElement('button');
        createBtn.textContent = 'Create';
        createBtn.className = 'btn-primary';
        createBtn.onclick = async () => {
            try {
                await this.wikiService.createPage(this.wikiId, titleInput.value, contentInput.value);
                document.body.removeChild(modal);
                this.container.innerHTML = '';
                this.render();
            } catch (error) {
                alert('Failed to create page: ' + error.message);
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

    showEditPageForm(page) {
        const modal = document.createElement('div');
        modal.className = 'modal';

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modal.appendChild(modalContent);

        const title = document.createElement('h2');
        title.textContent = 'Edit Page';
        modalContent.appendChild(title);

        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.placeholder = 'Page Title';
        titleInput.className = 'auth-input';
        titleInput.value = page.title;
        modalContent.appendChild(titleInput);

        const contentInput = document.createElement('textarea');
        contentInput.placeholder = 'Page Content (Markdown)';
        contentInput.className = 'auth-input';
        contentInput.rows = 15;
        contentInput.value = page.content;
        modalContent.appendChild(contentInput);

        const btnContainer = document.createElement('div');
        btnContainer.className = 'modal-buttons';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.className = 'btn-primary';
        saveBtn.onclick = async () => {
            try {
                await this.wikiService.updatePage(this.wikiId, page.id, titleInput.value, contentInput.value);
                document.body.removeChild(modal);
                await this.loadPage(page.id);
                const pageItem = document.querySelector(`[data-page-id="${page.id}"]`);
                if (pageItem) pageItem.textContent = titleInput.value;
            } catch (error) {
                alert('Failed to update page: ' + error.message);
            }
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'btn-danger';
        deleteBtn.onclick = async () => {
            if (!confirm('Are you sure you want to delete this page?')) return;
            try {
                await this.wikiService.deletePage(this.wikiId, page.id);
                document.body.removeChild(modal);
                this.container.innerHTML = '';
                this.render();
            } catch (error) {
                alert('Failed to delete page: ' + error.message);
            }
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'btn-secondary';
        cancelBtn.onclick = () => document.body.removeChild(modal);

        btnContainer.appendChild(saveBtn);
        btnContainer.appendChild(deleteBtn);
        btnContainer.appendChild(cancelBtn);
        modalContent.appendChild(btnContainer);

        document.body.appendChild(modal);
    }

    async showManageSection() {
        const modal = document.createElement('div');
        modal.className = 'modal';

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.maxWidth = '600px';
        modal.appendChild(modalContent);

        const title = document.createElement('h2');
        title.textContent = 'Manage Wiki';
        modalContent.appendChild(title);

        const tabs = document.createElement('div');
        tabs.className = 'manage-tabs';

        const pagesTab = document.createElement('button');
        pagesTab.textContent = 'Pages';
        pagesTab.className = 'tab-btn active';
        pagesTab.onclick = () => {
            pagesTab.classList.add('active');
            relsTab.classList.remove('active');
            this.renderManagePages(tabContent);
        };
        tabs.appendChild(pagesTab);

        const relsTab = document.createElement('button');
        relsTab.textContent = 'Relationships';
        relsTab.className = 'tab-btn';
        relsTab.onclick = async () => {
            relsTab.classList.add('active');
            pagesTab.classList.remove('active');
            await this.renderManageRelationships(tabContent);
        };
        tabs.appendChild(relsTab);

        modalContent.appendChild(tabs);

        const tabContent = document.createElement('div');
        tabContent.className = 'tab-content';
        modalContent.appendChild(tabContent);

        this.renderManagePages(tabContent);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.className = 'btn-secondary';
        closeBtn.style.width = '100%';
        closeBtn.style.marginTop = '15px';
        closeBtn.onclick = () => document.body.removeChild(modal);
        modalContent.appendChild(closeBtn);

        document.body.appendChild(modal);
    }

    renderManagePages(container) {
        container.innerHTML = '';

        if (this.pages.length === 0) {
            container.innerHTML = '<p class="no-pages">No pages yet</p>';
            return;
        }

        this.pages.forEach(page => {
            const row = document.createElement('div');
            row.className = 'manage-row';

            const name = document.createElement('span');
            name.textContent = page.title;
            name.className = 'manage-row-name';
            row.appendChild(name);

            const actions = document.createElement('div');
            actions.className = 'manage-row-actions';

            const editBtn = document.createElement('button');
            editBtn.textContent = 'Edit';
            editBtn.className = 'btn-icon';
            editBtn.onclick = () => {
                document.querySelector('.modal').remove();
                this.showEditPageForm(page);
            };
            actions.appendChild(editBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.className = 'btn-icon btn-icon-danger';
            deleteBtn.onclick = async () => {
                if (!confirm(`Delete "${page.title}"?`)) return;
                try {
                    await this.wikiService.deletePage(this.wikiId, page.id);
                    document.querySelector('.modal').remove();
                    this.container.innerHTML = '';
                    this.render();
                } catch (error) {
                    alert('Failed: ' + error.message);
                }
            };
            actions.appendChild(deleteBtn);

            row.appendChild(actions);
            container.appendChild(row);
        });
    }

    async renderManageRelationships(container) {
        console.log("Entering manage relationships...")
        container.innerHTML = '<p>Loading...</p>';

        const formTitle = document.createElement('h4');
        formTitle.textContent = 'Create New Relationship';
        formTitle.style.marginBottom = '10px';

        const fromLabel = document.createElement('label');
        fromLabel.textContent = 'From Page';
        fromLabel.className = 'manage-label';

        const fromSelect = document.createElement('select');
        fromSelect.className = 'auth-input';
        this.pages.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.title;
            fromSelect.appendChild(option);
        });

        const relLabel = document.createElement('label');
        relLabel.textContent = 'Relationship Type';
        relLabel.className = 'manage-label';

        const relSelect = document.createElement('select');
        relSelect.className = 'auth-input';
        const relTypes = [
            { value: 'prerequisite', text: 'Prerequisite (must read first)' },
            { value: 'similar_topic', text: 'Similar Topic' },
            { value: 'continues_from', text: 'Continues From' },
            { value: 'see_also', text: 'See Also' },
            { value: 'custom', text: 'Custom...' }
        ];
        relTypes.forEach(rt => {
            const option = document.createElement('option');
            option.value = rt.value;
            option.textContent = rt.text;
            relSelect.appendChild(option);
        });

        const customInput = document.createElement('input');
        customInput.type = 'text';
        customInput.placeholder = 'Enter custom relationship name';
        customInput.className = 'auth-input';
        customInput.style.display = 'none';

        relSelect.onchange = () => {
            customInput.style.display = relSelect.value === 'custom' ? 'block' : 'none';
        };

        const toLabel = document.createElement('label');
        toLabel.textContent = 'To Page';
        toLabel.className = 'manage-label';

        const toSelect = document.createElement('select');
        toSelect.className = 'auth-input';
        this.pages.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.title;
            toSelect.appendChild(option);
        });

        if (this.pages.length > 1) {
            toSelect.value = this.pages[1].id;
        }

        const createBtn = document.createElement('button');
        createBtn.textContent = 'Create Relationship';
        createBtn.className = 'btn-primary';
        createBtn.onclick = async () => {
            if (fromSelect.value === toSelect.value) {
                alert('Cannot create relationship between a page and itself!');
                return;
            }

            try {
                await this.wikiService.createRelationship(
                    this.wikiId,
                    fromSelect.value,
                    toSelect.value,
                    relSelect.value,
                    relSelect.value === 'custom' ? customInput.value : null,
                    false
                );

                await this.renderManageRelationships(container);
            } catch (error) {
                alert('Failed: ' + error.message);
            }
        };

        const existingTitle = document.createElement('h4');
        existingTitle.textContent = 'Existing Relationships';
        existingTitle.style.marginTop = '20px';
        existingTitle.style.marginBottom = '10px';

        const existingList = document.createElement('div');
        existingList.id = 'existing-relationships';

        container.innerHTML = '';
        container.appendChild(formTitle);
        container.appendChild(fromLabel);
        container.appendChild(fromSelect);
        container.appendChild(relLabel);
        container.appendChild(relSelect);
        container.appendChild(customInput);
        container.appendChild(toLabel);
        container.appendChild(toSelect);
        container.appendChild(createBtn);
        container.appendChild(existingTitle);
        container.appendChild(existingList);

        try {
            this.pages.forEach(async (page) => {
                const data = await this.wikiService.getPageRelationships(this.wikiId, page.id);
                
                data.outgoing.forEach(rel => {
                    const row = document.createElement('div');
                    row.className = 'manage-row';

                    const info = document.createElement('span');
                    info.className = 'manage-row-name';
                    info.textContent = `${rel.fromPageTitle} ──${rel.relationType}──> ${rel.toPageTitle}`;
                    row.appendChild(info);

                    const deleteBtn = document.createElement('button');
                    deleteBtn.textContent = 'Delete';
                    deleteBtn.className = 'btn-icon btn-icon-danger';
                    deleteBtn.onclick = async () => {
                        try {
                            await this.wikiService.deleteRelationship(
                                this.wikiId,
                                rel.fromPageId,
                                rel.toPageId,
                                rel.relationType
                            );
                            await this.renderManageRelationships(container);
                        } catch (error) {
                            alert('Failed: ' + error.message);
                        }
                    };
                    row.appendChild(deleteBtn);

                    existingList.appendChild(row);
                });
            });
        } catch (error) {
            console.error('Failed to load relationships:', error);
        }
    }

    async loadChatHistory() {
        try {
            const data = await this.wikiService.getChatHistory(this.wikiId, 50);
            const messages = data.messages || [];
            this.displayChatMessages(messages);
        } catch (error) {
            console.error('Failed to load chat:', error);
        }
    }

    displayChatMessages(messages) {
        const container = document.getElementById('chat-messages');
        if (!container) return;
        container.innerHTML = '';

        messages.forEach(msg => {
            this.displayMessage(msg);
        });

        container.scrollTop = container.scrollHeight;
    }

    displayMessage(msg) {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-message';

        const username = document.createElement('strong');

        const user = JSON.parse(localStorage.getItem('user'))
        if(msg.username === user.username) {
            msgDiv.classList.add('chatter')
            username.textContent = 'you: ';
        } else
        username.textContent = msg.username + ': ';
        msgDiv.appendChild(username);

        const text = document.createElement('span');
        text.textContent = msg.message;
        msgDiv.appendChild(text);

        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
    }

    async sendMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        if (!message) return;

        try {
            if (this.signalRConnection?.state === 'Connected') {
                await this.signalRConnection.invoke('SendMessage', this.wikiId, message);
            } else {
                await this.wikiService.sendMessage(this.wikiId, message);
                this.loadChatHistory();
            }
            input.value = '';
        } catch (error) {
            alert('Failed to send message: ' + error.message);
        }
    }

    startChatPolling() {
        this.chatPollInterval = setInterval(() => {
            this.loadChatHistory();
            this.updateTypingIndicator();
        }, 3000);
    }

    async updateTypingIndicator() {
        try {
            const data = await this.wikiService.getTypingUsers(this.wikiId);
            const currentUserId = JSON.parse(localStorage.getItem('user')).id;
            
            const typingUserIds = (data.typingUserIds || []).filter(id => id !== currentUserId);
            
            const indicator = document.getElementById('typing-indicator');
            if (!indicator) return;

            if (typingUserIds.length === 0) {
                indicator.style.display = 'none';
            } else {
                indicator.style.display = 'block';
                const userText = typingUserIds.length === 1 
                    ? 'Someone is typing...' 
                    : `${typingUserIds.length} people are typing...`;
                indicator.innerHTML = `<span class="typing-dots">${userText}</span>`;
            }
        } catch (error) {
            console.log(error)
        }
    }
    async updateOnlineUsers() {
        try {
            const data = await this.wikiService.getOnlineUsers(this.wikiId);
            const users = data.users || [];
            const count = data.onlineCount || 0;

            const section = document.getElementById('online-users-section');
            if (!section) return;

            section.innerHTML = '';

            const header = document.createElement('div');
            header.className = 'online-users-header';
            header.innerHTML = `<span class="online-indicator">🟢</span> ${count} online`;
            section.appendChild(header);

            if (users.length > 0) {
                const usersList = document.createElement('div');
                usersList.className = 'online-users-list';

                users.forEach(user => {
                    const userItem = document.createElement('div');
                    userItem.className = 'online-user-item';
                    userItem.textContent = user.username;
                    usersList.appendChild(userItem);
                });

                section.appendChild(usersList);
            }
        } catch (error) {
            console.error('Failed to update online users:', error);
        }
    }

    stopChatPolling() {
        if (this.chatPollInterval) {
            clearInterval(this.chatPollInterval);
        }
    }
}