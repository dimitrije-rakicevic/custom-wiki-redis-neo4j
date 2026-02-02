export class AuthView {
    constructor(container, authService, onSuccess) {
        this.container = container;
        this.authService = authService;
        this.onSuccess = onSuccess;
        this.isLoginMode = true;
    }

    render() {
        const authContainer = document.createElement('div');
        authContainer.className = 'auth-container';
        this.container.appendChild(authContainer);

        const title = document.createElement('h1');
        title.innerHTML = 'Custom<span>Wiki</span>';
        title.className = 'auth-title';
        authContainer.appendChild(title);

        const form = document.createElement('div');
        form.className = 'auth-form';
        authContainer.appendChild(form);

        this.renderForm(form);
    }

    renderForm(formContainer) {
        formContainer.innerHTML = '';

        const title = document.createElement('h2');
        title.textContent = this.isLoginMode ? 'Login' : 'Register';
        formContainer.appendChild(title);

        if (!this.isLoginMode) {
            const usernameInput = this.createInput('text', 'Username', 'username-input');
            formContainer.appendChild(usernameInput);
        }

        const emailInput = this.createInput('email', 'Email', 'email-input');
        formContainer.appendChild(emailInput);

        const passwordInput = this.createInput('password', 'Password', 'password-input');
        formContainer.appendChild(passwordInput);

        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.display = 'none';
        formContainer.appendChild(errorDiv);

        const submitBtn = document.createElement('button');
        submitBtn.textContent = this.isLoginMode ? 'Login' : 'Register';
        submitBtn.className = 'btn-primary';
        submitBtn.onclick = () => this.handleSubmit(formContainer, errorDiv);
        formContainer.appendChild(submitBtn);

        const toggleDiv = document.createElement('div');
        toggleDiv.className = 'auth-toggle';
        const toggleText = document.createElement('span');
        toggleText.textContent = this.isLoginMode 
            ? "Don't have an account? " 
            : "Already have an account? ";
        const toggleLink = document.createElement('a');
        toggleLink.textContent = this.isLoginMode ? 'Register' : 'Login';
        toggleLink.href = '#';
        toggleLink.onclick = (e) => {
            e.preventDefault();
            this.isLoginMode = !this.isLoginMode;
            this.renderForm(formContainer);
        };
        toggleDiv.appendChild(toggleText);
        toggleDiv.appendChild(toggleLink);
        formContainer.appendChild(toggleDiv);
    }

    createInput(type, placeholder, className) {
        const input = document.createElement('input');
        input.type = type;
        input.placeholder = placeholder;
        input.className = `auth-input ${className}`;
        return input;
    }

    async handleSubmit(form, errorDiv) {
        const email = form.querySelector('.email-input').value;
        const password = form.querySelector('.password-input').value;

        if (!email || !password) {
            this.showError(errorDiv, 'Please fill all fields');
            return;
        }

        try {
            if (this.isLoginMode) {
                await this.authService.login(email, password);
            } else {
                const username = form.querySelector('.username-input').value;
                if (!username) {
                    this.showError(errorDiv, 'Please fill all fields');
                    return;
                }
                await this.authService.register(username, email, password);
            }
            this.onSuccess();
        } catch (error) {
            this.showError(errorDiv, error.message);
        }
    }

    showError(errorDiv, message) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
}